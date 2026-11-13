import { Command } from "@alchemy.run/domain";
import { Array as Arr, DateTime, Function as Fn, Match, Schema } from "effect";

import { nextAfter } from "#src/recurring/next-occurrence.pure.js";
import { RecurringName } from "#src/recurring/recurring.id.js";
import type { RecurringState } from "#src/recurring/recurring-state.schema.js";
import { Ticked } from "#src/recurring/tick/ticked.event.js";

// Scheduled, so it never rejects: a tick that is not the one the schedule waits for records nothing.
class Tick extends Command(
  "Tick",
  { events: [Ticked], input: { scheduledFor: Schema.DateTimeUtc }, target: RecurringName },
  { description: "One occurrence of a recurring schedule is due." },
) {}

const decideArity = 3;

// Only the tick the schedule waits for runs: a repeat, a stale arming or a tick after Pause records nothing. A late
// Tick runs once and the next one is due after now, so missed occurrences are not replayed.
const decideTick: {
  (command: Tick, now: DateTime.Utc): (state: RecurringState) => readonly Ticked[];
  (state: RecurringState, command: Tick, now: DateTime.Utc): readonly Ticked[];
} = Fn.dual(decideArity, (state: RecurringState, command: Tick, now: DateTime.Utc): readonly Ticked[] =>
  Match.valueTags(state, {
    Running: (running) => {
      if (!DateTime.Equivalence(running.nextDue, command.scheduledFor)) {
        return [];
      }

      return Arr.map(nextAfter(running, DateTime.max(now, command.scheduledFor)), (nextDue) =>
        Ticked.make({ at: now, nextDue, scheduledFor: command.scheduledFor }),
      );
    },
    Stopped: () => [],
    Unarmed: () => [],
  }),
);

export { decideTick, Tick };
