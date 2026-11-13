import { Schema } from "effect";

// The host did not complete ui/initialize: it refused, answered something that is not an initialize result, or never
// Answered. A panel cannot show anything without a host, so this is the one failure that stops it.
class HostHandshakeError extends Schema.TaggedError<HostHandshakeError, { readonly brand: unique symbol }>()(
  "HostHandshakeError",
  { message: Schema.String },
) {}

export { HostHandshakeError };
