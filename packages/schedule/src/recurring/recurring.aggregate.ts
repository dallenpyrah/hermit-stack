import { Aggregate } from "@alchemy.run/domain";
import { Match } from "effect";

import { Arm, decideArm } from "#src/recurring/arm/arm.command.js";
import { decidePause, Pause } from "#src/recurring/pause/pause.command.js";
import { RecurringName } from "#src/recurring/recurring.id.js";
import { RecurringState, Running, Stopped, Unarmed } from "#src/recurring/recurring-state.schema.js";
import { decideTick, Tick } from "#src/recurring/tick/tick.command.js";

class Recurring extends Aggregate(
  "Recurring",
  {
    commands: [Arm, Tick, Pause],
    decide: {
      Arm: (_state, command, { now }) => decideArm(command, now),
      Pause: decidePause,
      Tick: (state, command, { now }) => decideTick(state, command, now),
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
