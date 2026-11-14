import { Schema } from "effect";

class SandboxProviderError extends Schema.TaggedError<SandboxProviderError, { readonly brand: unique symbol }>()(
  "SandboxProviderError",
  { message: Schema.String, operation: Schema.String },
) {}

export { SandboxProviderError };
