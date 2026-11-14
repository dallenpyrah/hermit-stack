import { Schema } from "effect";

const FeedState = Schema.Struct({ published: Schema.Int });

type FeedState = typeof FeedState.Type;

export { FeedState };
