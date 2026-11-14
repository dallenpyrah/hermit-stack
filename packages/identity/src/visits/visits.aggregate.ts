import { Aggregate } from "@alchemy.run/domain";
import { Number as Num } from "effect";

import { UserId } from "#src/user.id.js";
import { CheckIn, decideCheckIn } from "#src/visits/check-in/check-in.command.js";
import { VisitsState } from "#src/visits/visits-state.schema.js";

class Visits extends Aggregate(
  "Visits",
  {
    commands: [CheckIn],
    decide: { CheckIn: decideCheckIn },
    evolve: {
      CheckedIn: (state, event): VisitsState => ({ name: event.name, visits: Num.increment(state.visits) }),
    },
    id: UserId,
    initial: { name: "", visits: 0 },
    reply: { CheckIn: (state): VisitsState => state },
    state: VisitsState,
  },
  { description: "How often each user checked in, and the name they last checked in under." },
) {}

export { Visits };
