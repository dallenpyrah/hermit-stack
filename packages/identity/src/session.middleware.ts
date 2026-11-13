import { RpcMiddleware } from "effect/rpc";

import type { CurrentUser } from "#src/current-user.context.js";
import { UnauthorizedError } from "#src/unauthorized.rejection.js";

// The port names no auth vendor: an adapter Layer reads the request's headers and provides the user, or refuses.
class Session extends RpcMiddleware.Service<Session, { provides: CurrentUser }>()("Identity/Session", {
  error: UnauthorizedError,
}) {}

export { Session };
