import { Schema } from "effect";

import { Channel } from "#src/notification/channel.schema.js";

const NotificationAddress = Schema.Struct({ channel: Channel, notificationId: Schema.String, to: Schema.String });

const Accepted = Schema.TaggedStruct("Accepted", { messageId: Schema.String });

const Refused = Schema.TaggedStruct("Refused", { reason: Schema.String });

const DeliveryResult = Schema.Union([Accepted, Refused]);

export { Accepted, DeliveryResult, NotificationAddress, Refused };
