import { Command } from "@alchemy.run/domain";
import { Match } from "effect";

import { Paused } from "#src/recurring/pause/paused.event.js";
import { RecurringName } from "#src/recurring/recurring.id.js";
import type { RecurringState } from "#src/recurring/recurring-state.schema.js";

// The pending tick still fires, records nothing and arms nothing, so the chain stops until the next Arm.
class Pause extends Command(
  "Pause",
  { events: [Paused], target: RecurringName },
  { description: "Stop a recurring schedule until it is armed again." },
) {}

const decidePause = (state: RecurringState): readonly Paused[] =>
  Match.valueTags(state, {
    Running: () => [Paused.make({})],
    Stopped: () => [],
    Unarmed: () => [],
  });

export { decidePause, Pause };
