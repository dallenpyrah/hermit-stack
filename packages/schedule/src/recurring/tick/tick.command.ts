import { Command } from "@alchemy.run/domain";
import { Array as Arr, DateTime, Function as Fn, Match, Schema } from "effect";

import { nextAfter } from "#src/recurring/next-occurrence.pure.js";
import { RecurringName } from "#src/recurring/recurring.id.js";
import type { RecurringState } from "#src/recurring/recurring-state.schema.js";
import { Ticked } from "#src/recurring/tick/ticked.event.js";

class Tick extends Command(
  "Tick",
  { events: [Ticked], input: { scheduledFor: Schema.DateTimeUtc }, target: RecurringName },
  { description: "One occurrence of a recurring schedule is due." },
) {}

const decideArity = 3;

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
