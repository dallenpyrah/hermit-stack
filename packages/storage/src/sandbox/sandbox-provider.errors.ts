import { Schema } from "effect";

// A sandbox that would not start or stop, or a command the vendor could not run. A command that ran and exited
// Non-zero is not an error: its exit code says so.
class SandboxProviderError extends Schema.TaggedError<SandboxProviderError, { readonly brand: unique symbol }>()(
  "SandboxProviderError",
  { message: Schema.String, operation: Schema.String },
) {}

export { SandboxProviderError };
