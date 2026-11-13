import { Schema } from "effect";

// Everything the vendor can fail with that the application cannot act on differently: a refused key, an outage, a
// Malformed name, a disk that is gone.
class DiskProviderError extends Schema.TaggedError<DiskProviderError, { readonly brand: unique symbol }>()(
  "DiskProviderError",
  { message: Schema.String, operation: Schema.String },
) {}

export { DiskProviderError };
