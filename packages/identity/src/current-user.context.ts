import { RequestContext } from "@alchemy.run/domain";
import { Schema } from "effect";

import { UserId } from "#src/user.id.js";

// A request context has a schema because the user travels with a command to wherever its aggregate runs.
class CurrentUser extends RequestContext<CurrentUser>()(
  "Identity/CurrentUser",
  Schema.Struct({ name: Schema.String, userId: UserId }),
) {}

export { CurrentUser };
