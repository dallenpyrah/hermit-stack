import { Schema } from "effect";

class UnauthorizedError extends Schema.TaggedError<UnauthorizedError, { readonly brand: unique symbol }>()(
  "Unauthorized",
  {},
  { description: "The request carries no valid session.", httpApiStatus: 401 },
) {}

export { UnauthorizedError };
