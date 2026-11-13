import { Command, Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { Channel } from "#src/notification/channel.schema.js";
import { UserId } from "#src/notification/user.id.js";

const EmailSet = Event("EmailSet", { address: Schema.String });

type EmailSet = typeof EmailSet.Type;

const SetEmail = Command(
  "SetEmail",
  { events: [EmailSet], input: { address: Schema.String }, target: UserId },
  { description: "Set the address a recipient's email notifications go to." },
);

type SetEmail = typeof SetEmail.Type;

const DeviceRegistered = Event("DeviceRegistered", { token: Schema.String });

const RegisterDevice = Command(
  "RegisterDevice",
  { events: [DeviceRegistered], input: { token: Schema.String }, target: UserId },
  { description: "Add a device that receives a recipient's push notifications." },
);

const DeviceRemoved = Event("DeviceRemoved", { token: Schema.String });

// Also what a push vendor's invalid-token callback turns into, so a dead device stops receiving.
const RemoveDevice = Command(
  "RemoveDevice",
  { events: [DeviceRemoved], input: { token: Schema.String }, target: UserId },
  { description: "Stop sending push notifications to a device." },
);

const Preference = { channel: Channel, enabled: Schema.Boolean, kind: Schema.String };

const PreferenceSet = Event("PreferenceSet", Preference);

type PreferenceSet = typeof PreferenceSet.Type;

// Every kind reaches every channel until the recipient turns one off, so a new kind needs no migration.
const SetPreference = Command(
  "SetPreference",
  { events: [PreferenceSet], input: Preference, target: UserId },
  { description: "Turn one kind of notification on or off for one channel." },
);

type SetPreference = typeof SetPreference.Type;

// One per channel and address the recipient's preferences allow; to is the user id, the email address or the device
// Token.
const NotificationQueued = Event("NotificationQueued", {
  channel: Channel,
  kind: Schema.String,
  notificationId: Schema.String,
  payload: Schema.Json,
  to: Schema.String,
});

type NotificationQueued = typeof NotificationQueued.Type;

// Sent by a policy with the command id <eventId>:<userId>, so a public event notifies each user once.
const Notify = Command(
  "Notify",
  {
    events: [NotificationQueued],
    input: { kind: Schema.String, notificationId: Schema.String, payload: Schema.Json },
    target: UserId,
  },
  { description: "Tell a recipient about a public event, on every channel they allow." },
);

type Notify = typeof Notify.Type;

const Sent = { channel: Channel, notificationId: Schema.String, to: Schema.String };

const NotificationSent = Event("NotificationSent", { ...Sent, messageId: Schema.String });

type NotificationSent = typeof NotificationSent.Type;

const NotificationFailed = Event("NotificationFailed", { ...Sent, reason: Schema.String });

type NotificationFailed = typeof NotificationFailed.Type;

const Accepted = Schema.TaggedStruct("Accepted", { messageId: Schema.String });

const Refused = Schema.TaggedStruct("Refused", { reason: Schema.String });

// Reports what the vendor said, so it never rejects; the vendor's message id lets a later bounce find the notification.
const RecordDelivery = Command(
  "RecordDelivery",
  {
    events: [NotificationSent, NotificationFailed],
    input: { ...Sent, result: Schema.Union([Accepted, Refused]) },
    target: UserId,
  },
  { description: "Record what the email or push vendor answered for one notification." },
);

type RecordDelivery = typeof RecordDelivery.Type;

const NotificationRead = Event("NotificationRead", { notificationId: Schema.String });

type NotificationRead = typeof NotificationRead.Type;

const MarkRead = Command(
  "MarkRead",
  { events: [NotificationRead], input: { notificationId: Schema.String }, target: UserId },
  { description: "Mark a notification in the inbox as read." },
);

export {
  Accepted,
  DeviceRegistered,
  DeviceRemoved,
  EmailSet,
  MarkRead,
  NotificationFailed,
  NotificationQueued,
  NotificationRead,
  NotificationSent,
  Notify,
  PreferenceSet,
  RecordDelivery,
  Refused,
  RegisterDevice,
  RemoveDevice,
  SetEmail,
  SetPreference,
};
