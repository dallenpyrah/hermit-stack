import { RequestContext } from "@alchemy.run/domain";
import { Schema } from "effect";

import { UserId } from "#src/user.id.js";

class CurrentUser extends RequestContext<CurrentUser>()(
  "Identity/CurrentUser",
  Schema.Struct({ name: Schema.String, userId: UserId }),
) {}

export { CurrentUser };
