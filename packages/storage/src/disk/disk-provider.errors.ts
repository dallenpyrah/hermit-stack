import { Schema } from "effect";

class DiskProviderError extends Schema.TaggedError<DiskProviderError, { readonly brand: unique symbol }>()(
  "DiskProviderError",
  { message: Schema.String, operation: Schema.String },
) {}

export { DiskProviderError };
