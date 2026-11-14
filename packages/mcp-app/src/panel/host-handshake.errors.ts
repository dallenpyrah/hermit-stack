import { Schema } from "effect";

class HostHandshakeError extends Schema.TaggedError<HostHandshakeError, { readonly brand: unique symbol }>()(
  "HostHandshakeError",
  { message: Schema.String },
) {}

export { HostHandshakeError };
