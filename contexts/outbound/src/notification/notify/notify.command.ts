import { Command } from "@alchemy.run/domain";
import { Array as Arr, Function as Fn, Option, Schema } from "effect";

import { Channel } from "#src/notification/channel.schema.js";
import { isMuted } from "#src/notification/muted.pure.js";
import { NotificationQueued } from "#src/notification/notify/notification-queued.event.js";
import type { RecipientState } from "#src/notification/recipient-state.schema.js";
import { UserId } from "#src/notification/user.id.js";

// Sent by a policy with the command id <eventId>:<userId>, so a public event notifies each user once.
class Notify extends Command(
  "Notify",
  {
    events: [NotificationQueued],
    input: { kind: Schema.String, notificationId: Schema.String, payload: Schema.Json },
    target: UserId,
  },
  { description: "Tell a recipient about a public event, on every channel they allow." },
) {}

const Address = Schema.Struct({ channel: Channel, to: Schema.String });

type Address = typeof Address.Type;

// The inbox is always there; email and push only once the recipient gave an address or a device.
const addresses = (state: RecipientState, userId: UserId): readonly Address[] => [
  Address.make({ channel: "inbox", to: userId }),
  ...Arr.map(Option.toArray(state.email), (to) => Address.make({ channel: "email", to })),
  ...Arr.map(state.devices, (to) => Address.make({ channel: "push", to })),
];

const decideArity = 3;

const decideNotify: {
  (command: Notify, userId: UserId): (state: RecipientState) => readonly NotificationQueued[];
  (state: RecipientState, command: Notify, userId: UserId): readonly NotificationQueued[];
} = Fn.dual(decideArity, (state: RecipientState, command: Notify, userId: UserId): readonly NotificationQueued[] =>
  Arr.map(
    Arr.filter(
      addresses(state, userId),
      (address) => !isMuted(state, { channel: address.channel, kind: command.kind }),
    ),
    (address) =>
      NotificationQueued.make({
        channel: address.channel,
        kind: command.kind,
        notificationId: command.notificationId,
        payload: command.payload,
        to: address.to,
      }),
  ),
);

export { decideNotify, Notify };
