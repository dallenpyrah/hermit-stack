import { Schema } from "effect";

// How many events the tenant's feed holds, which is also the position of the latest one.
const FeedState = Schema.Struct({ published: Schema.Int });

type FeedState = typeof FeedState.Type;

export { FeedState };
