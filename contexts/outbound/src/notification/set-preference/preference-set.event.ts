import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { Channel } from "#src/notification/channel.schema.js";

class PreferenceSet extends Event("PreferenceSet", {
  channel: Channel,
  enabled: Schema.Boolean,
  kind: Schema.String,
}) {}

export { PreferenceSet };
