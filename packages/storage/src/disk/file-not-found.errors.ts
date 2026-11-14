import { Schema } from "effect";

import { DiskId } from "./disk.schema.js";

class FileNotFoundError extends Schema.TaggedError<FileNotFoundError, { readonly brand: unique symbol }>()(
  "FileNotFoundError",
  { disk: DiskId, path: Schema.String },
) {}

export { FileNotFoundError };
