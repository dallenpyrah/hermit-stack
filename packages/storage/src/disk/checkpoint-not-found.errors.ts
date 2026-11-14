import { Schema } from "effect";

import { CheckpointId } from "./disk.schema.js";

class CheckpointNotFoundError extends Schema.TaggedError<CheckpointNotFoundError, { readonly brand: unique symbol }>()(
  "CheckpointNotFoundError",
  { checkpoint: CheckpointId },
) {}

export { CheckpointNotFoundError };
