import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { NotificationAddress } from "#src/notification/record-delivery/delivery-result.schema.js";

class NotificationFailed extends Event("NotificationFailed", {
  ...NotificationAddress.fields,
  reason: Schema.String,
}) {}

export { NotificationFailed };
