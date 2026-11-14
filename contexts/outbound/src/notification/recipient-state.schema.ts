import { Schema } from "effect";

import { Channel } from "#src/notification/channel.schema.js";

const Muted = Schema.Struct({ channel: Channel, kind: Schema.String });

type Muted = typeof Muted.Type;

const RecipientState = Schema.Struct({
  devices: Schema.Array(Schema.String),
  email: Schema.Option(Schema.String),
  muted: Schema.Array(Muted),
});

type RecipientState = typeof RecipientState.Type;

export { Muted, RecipientState };
