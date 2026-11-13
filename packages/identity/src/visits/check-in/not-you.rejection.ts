import { Schema } from "effect";

class NotYouError extends Schema.TaggedError<NotYouError, { readonly brand: unique symbol }>()(
  "NotYou",
  {},
  { description: "A signed-in user checks in only as themselves." },
) {}

export { NotYouError };
