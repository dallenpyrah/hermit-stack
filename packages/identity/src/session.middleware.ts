import { RpcMiddleware } from "effect/rpc";

import type { CurrentUser } from "#src/current-user.context.js";
import { UnauthorizedError } from "#src/unauthorized.rejection.js";

class Session extends RpcMiddleware.Service<Session, { provides: CurrentUser }>()("Identity/Session", {
  error: UnauthorizedError,
}) {}

export { Session };
