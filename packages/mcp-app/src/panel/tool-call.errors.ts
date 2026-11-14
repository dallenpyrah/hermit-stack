import { Schema } from "effect";

class ToolCallError extends Schema.TaggedError<ToolCallError, { readonly brand: unique symbol }>()("ToolCallError", {
  message: Schema.String,
  tool: Schema.String,
}) {}

export { ToolCallError };
