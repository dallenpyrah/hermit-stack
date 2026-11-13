import { Schema } from "effect";

// One error for no session, an altered one and an expired one, so a caller learns nothing about why a credential failed.
class UnauthorizedError extends Schema.TaggedError<UnauthorizedError, { readonly brand: unique symbol }>()(
  "Unauthorized",
  {},
  { description: "The request carries no valid session.", httpApiStatus: 401 },
) {}

export { UnauthorizedError };
