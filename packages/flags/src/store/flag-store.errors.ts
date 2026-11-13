import { Schema } from "effect";

class FlagStoreError extends Schema.TaggedError<FlagStoreError, { readonly brand: unique symbol }>()("FlagStoreError", {
  cause: Schema.Defect(),
  flag: Schema.String,
}) {}

export { FlagStoreError };
