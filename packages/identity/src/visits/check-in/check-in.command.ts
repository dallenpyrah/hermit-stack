import { Command } from "@alchemy.run/domain";
import type { DecideContext } from "@alchemy.run/domain/Aggregate";
import { Effect, Schema } from "effect";

import { CurrentUser } from "#src/current-user.context.js";
import { Session } from "#src/session.middleware.js";
import { UserId } from "#src/user.id.js";
import { CheckedIn } from "#src/visits/check-in/checked-in.event.js";
import { NotYouError } from "#src/visits/check-in/not-you.rejection.js";
import type { VisitsState } from "#src/visits/visits-state.schema.js";

// The sample command the Session contract drives: it lists the middleware, so it runs only for a signed-in user.
class CheckIn extends Command(
  "CheckIn",
  {
    events: [CheckedIn],
    middleware: [Session],
    rejects: [NotYouError],
    reply: { name: Schema.String, visits: Schema.Int },
    target: UserId,
  },
  { description: "Record a visit by the signed-in user, who must be the user the command names." },
) {}

// Decide reads the user the middleware provided, so a command reaching another user's visits is refused here.
const decideCheckIn = Effect.fn("decideCheckIn")(function* decideCheckIn(
  _state: VisitsState,
  _command: CheckIn,
  { id }: DecideContext<UserId>,
) {
  const user = yield* CurrentUser;

  if (user.userId !== id) {
    return yield* NotYouError.make();
  }

  return [CheckedIn.make({ name: user.name })];
});

export { CheckIn, decideCheckIn };
