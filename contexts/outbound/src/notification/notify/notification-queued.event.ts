import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { Channel } from "#src/notification/channel.schema.js";

// One per channel and address the recipient's preferences allow; to is the user id, the email address or the device
// Token.
class NotificationQueued extends Event("NotificationQueued", {
  channel: Channel,
  kind: Schema.String,
  notificationId: Schema.String,
  payload: Schema.Json,
  to: Schema.String,
}) {}

export { NotificationQueued };
