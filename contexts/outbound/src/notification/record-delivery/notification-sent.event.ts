import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { NotificationAddress } from "#src/notification/record-delivery/delivery-result.schema.js";

// The vendor's message id lets a later bounce find the notification.
class NotificationSent extends Event("NotificationSent", {
  ...NotificationAddress.fields,
  messageId: Schema.String,
}) {}

export { NotificationSent };
