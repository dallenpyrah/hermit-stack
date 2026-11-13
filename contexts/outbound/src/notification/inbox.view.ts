import { View } from "@alchemy.run/domain";
import { Array as Arr, Number as Num, Schema } from "effect";

import type { NotificationRead } from "#src/notification/mark-read/notification-read.event.js";
import type { NotificationQueued } from "#src/notification/notify/notification-queued.event.js";
import { Recipient } from "#src/notification/recipient.aggregate.js";

const InboxItem = Schema.Struct({
  kind: Schema.String,
  notificationId: Schema.String,
  payload: Schema.Json,
  read: Schema.Boolean,
});

const InboxState = Schema.Struct({ items: Schema.Array(InboxItem), unread: Schema.Int });

type InboxState = typeof InboxState.Type;

const receive = (inbox: InboxState, event: NotificationQueued): InboxState => {
  if (event.channel !== "inbox") {
    return inbox;
  }

  const item = { kind: event.kind, notificationId: event.notificationId, payload: event.payload, read: false };

  return { items: [...inbox.items, item], unread: Num.increment(inbox.unread) };
};

// Reading twice, or reading a notification that is not here, leaves the unread count as it is.
const markRead = (inbox: InboxState, event: NotificationRead): InboxState => {
  const unread = Arr.some(inbox.items, (item) => item.notificationId === event.notificationId && !item.read);

  if (!unread) {
    return inbox;
  }

  return {
    items: Arr.map(inbox.items, (item) => {
      if (item.notificationId === event.notificationId) {
        return { ...item, read: true };
      }

      return item;
    }),
    unread: Num.decrement(inbox.unread),
  };
};

// Every open screen watches it, so the unread count changes everywhere with no push vendor involved.
class Inbox extends View(
  "Inbox",
  {
    evolve: {
      NotificationQueued: receive,
      NotificationRead: markRead,
    },
    from: [Recipient],
    initial: { items: [], unread: 0 },
    key: Recipient,
    state: InboxState,
  },
  { description: "A user's in-app notifications, oldest first, with how many are unread." },
) {}

export { Inbox };
