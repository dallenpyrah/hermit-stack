import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { Channel } from "#src/notification/channel.schema.js";

class NotificationQueued extends Event("NotificationQueued", {
  channel: Channel,
  kind: Schema.String,
  notificationId: Schema.String,
  payload: Schema.Json,
  to: Schema.String,
}) {}

export { NotificationQueued };
