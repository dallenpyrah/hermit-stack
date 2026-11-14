import { Schema } from "effect";

const PublicEvent = Schema.Struct({
  audience: Schema.Array(Schema.String),
  id: Schema.String,
  occurredAt: Schema.DateTimeUtc,
  payload: Schema.Json,
  type: Schema.String,
});

type PublicEvent = typeof PublicEvent.Type;

export { PublicEvent };
