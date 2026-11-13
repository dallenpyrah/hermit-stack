import { Schema } from "effect";

import { Channel } from "#src/notification/channel.schema.js";

// One kind of notification the recipient turned off for one channel.
const Muted = Schema.Struct({ channel: Channel, kind: Schema.String });

type Muted = typeof Muted.Type;

// Where a recipient can be reached and what they turned off. Quiet hours and digests are not modelled yet.
const RecipientState = Schema.Struct({
  devices: Schema.Array(Schema.String),
  email: Schema.Option(Schema.String),
  muted: Schema.Array(Muted),
});

type RecipientState = typeof RecipientState.Type;

export { Muted, RecipientState };
