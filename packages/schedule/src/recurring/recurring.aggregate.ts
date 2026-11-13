import { Aggregate } from "@alchemy.run/domain";
import { Array as Arr, Cron, DateTime, Match, Result, Schema } from "effect";

import { Arm, Armed, Pause, Paused, Tick, Ticked } from "#src/recurring/recurring.command.js";
import { RecurringName } from "#src/recurring/recurring.id.js";

const Settings = { cron: Schema.String, timeZone: Schema.String };

const Unarmed = Schema.TaggedStruct("Unarmed", {});

const Running = Schema.TaggedStruct("Running", { ...Settings, nextDue: Schema.DateTimeUtc });

const Stopped = Schema.TaggedStruct("Stopped", Settings);

const RecurringState = Schema.Union([Unarmed, Running, Stopped]);

type RecurringState = typeof RecurringState.Type;

// The next occurrence strictly after a time, read in the schedule's own time zone. Arm's input schema already accepted
// The expression and the zone, so a parse that fails here has no next occurrence.
const nextAfter = (settings: typeof Running.Type | Arm, after: DateTime.Utc): readonly DateTime.Utc[] =>
  Result.match(Cron.parse(settings.cron, settings.timeZone), {
    onFailure: () => [],
    onSuccess: (cron) => [DateTime.fromDateUnsafe(Cron.next(cron, after))],
  });

const arm = (command: Arm, now: DateTime.Utc): readonly Armed[] =>
  Arr.map(nextAfter(command, now), (nextDue) =>
    Armed.make({ cron: command.cron, nextDue, timeZone: command.timeZone }),
  );

// Only the tick the schedule waits for runs: a repeat, a stale arming or a tick after Pause records nothing. A late
// Tick runs once and the next one is due after now, so missed occurrences are not replayed.
const tick = (state: RecurringState, command: Tick, now: DateTime.Utc): readonly Ticked[] =>
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
  });

const pause = (state: RecurringState): readonly Paused[] =>
  Match.valueTags(state, {
    Running: () => [Paused.make({})],
    Stopped: () => [],
    Unarmed: () => [],
  });

// Recurring work as an aggregate that re-arms itself: each Ticked is the work's trigger, and the Rearm policy
// Schedules the next Tick from it, so no cron service runs outside the model.
class Recurring extends Aggregate(
  "Recurring",
  {
    commands: [Arm, Tick, Pause],
    decide: {
      Arm: (_state, command, { now }) => arm(command, now),
      Pause: (state) => pause(state),
      Tick: (state, command, { now }) => tick(state, command, now),
    },
    evolve: {
      Armed: (_state, event) => Running.make({ cron: event.cron, nextDue: event.nextDue, timeZone: event.timeZone }),
      Paused: (state) =>
        Match.valueTags(state, {
          Running: (running) => Stopped.make({ cron: running.cron, timeZone: running.timeZone }),
          Stopped: (stopped) => stopped,
          Unarmed: (unarmed) => unarmed,
        }),
      Ticked: (state, event) =>
        Match.valueTags(state, {
          Running: (running) => Running.make({ ...running, nextDue: event.nextDue }),
          Stopped: (stopped) => stopped,
          Unarmed: (unarmed) => unarmed,
        }),
    },
    id: RecurringName,
    initial: Unarmed.make({}),
    state: RecurringState,
  },
  { description: "A recurring schedule: its cron expression, time zone and next due time." },
) {}

export { Recurring };
