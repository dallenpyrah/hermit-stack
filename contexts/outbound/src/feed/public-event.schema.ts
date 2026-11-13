import { Schema } from "effect";

// A fact a context chose to make public. Its id is the publishing event's id, so every step after it derives its own
// Id from it; audience lists the user ids to notify, chosen by the publisher.
const PublicEvent = Schema.Struct({
  audience: Schema.Array(Schema.String),
  id: Schema.String,
  occurredAt: Schema.DateTimeUtc,
  payload: Schema.Json,
  type: Schema.String,
});

type PublicEvent = typeof PublicEvent.Type;

export { PublicEvent };
