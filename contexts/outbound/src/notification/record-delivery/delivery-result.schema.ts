import { Schema } from "effect";

import { Channel } from "#src/notification/channel.schema.js";

// One notification on its way to one address: the user id, the email address or the device token.
const NotificationAddress = Schema.Struct({ channel: Channel, notificationId: Schema.String, to: Schema.String });

const Accepted = Schema.TaggedStruct("Accepted", { messageId: Schema.String });

const Refused = Schema.TaggedStruct("Refused", { reason: Schema.String });

// What the email or push vendor answered.
const DeliveryResult = Schema.Union([Accepted, Refused]);

export { Accepted, DeliveryResult, NotificationAddress, Refused };
