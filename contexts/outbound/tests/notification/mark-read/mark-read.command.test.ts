import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { Inbox } from "#src/notification/inbox.view.js";
import { MarkRead } from "#src/notification/mark-read/mark-read.command.js";
import { NotificationRead } from "#src/notification/mark-read/notification-read.event.js";
import { NotificationQueued } from "#src/notification/notify/notification-queued.event.js";
import { Notify } from "#src/notification/notify/notify.command.js";
import { PreferenceSet } from "#src/notification/set-preference/preference-set.event.js";
import { sam } from "#tests/notification/notification.suite";
import { outboundStory } from "#tests/outbound.suite";

const { given, then, view, when } = Story;

type Case = () => ReturnType<typeof outboundStory>;

const paid = { kind: "invoice.paid", notificationId: "event-1", payload: { invoiceId: "invoice-7" } };
const overdue = { kind: "invoice.overdue", notificationId: "event-2", payload: { invoiceId: "invoice-8" } };

const archived = { kind: "invoice.archived", notificationId: "event-3", payload: { invoiceId: "invoice-7" } };

const readsOnce: Case = () =>
  outboundStory(
    given(sam, PreferenceSet.make({ channel: "inbox", enabled: false, kind: "invoice.archived" })),
    when(sam, Notify.make(paid)),
    then(sam, NotificationQueued.make({ ...paid, channel: "inbox", to: sam.id })),
    when(sam, Notify.make(overdue)),
    then(sam, NotificationQueued.make({ ...overdue, channel: "inbox", to: sam.id })),
    view(Inbox, sam, { unread: 2 }),
    when(sam, MarkRead.make({ notificationId: "event-1" })),
    then(sam, NotificationRead.make({ notificationId: "event-1" })),
    view(Inbox, sam, {
      items: [
        { ...paid, read: true },
        { ...overdue, read: false },
      ],
      unread: 1,
    }),
    when(sam, MarkRead.make({ notificationId: "event-1" })),
    then(sam, NotificationRead.make({ notificationId: "event-1" })),
    view(Inbox, sam, { unread: 1 }),
    when(sam, MarkRead.make({ notificationId: "event-9" })),
    then(sam, NotificationRead.make({ notificationId: "event-9" })),
    view(Inbox, sam, {
      items: [
        { ...paid, read: true },
        { ...overdue, read: false },
      ],
      unread: 1,
    }),
    when(sam, Notify.make(archived)),
    then(sam),
  );

describe("marking a notification read", () => {
  it.effect("marks only that notification and lowers the unread count once", readsOnce);
});
