import { Schema } from "effect";

// A tool call that never reached its tool's own answer: the params did not fit the tool, the host refused the call,
// The result could not be read, or the call was cancelled. A rejection the tool returns is its typed failure instead.
class ToolCallError extends Schema.TaggedError<ToolCallError, { readonly brand: unique symbol }>()("ToolCallError", {
  message: Schema.String,
  tool: Schema.String,
}) {}

export { ToolCallError };
