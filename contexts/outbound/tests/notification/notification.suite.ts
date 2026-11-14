import { Story } from "@alchemy.run/domain/Story";
import type { Step } from "@alchemy.run/domain/Story";
import { DateTime } from "effect";

import { Feed } from "#src/feed/feed.aggregate.js";
import { Publish } from "#src/feed/publish/publish.command.js";
import { Published } from "#src/feed/publish/published.event.js";
import { FeedEntry, PublicEvents } from "#src/feed/public-events.projection.js";
import { Push } from "#src/notification/push.external.js";
import { Recipient } from "#src/notification/recipient.aggregate.js";
import { NotificationSent } from "#src/notification/record-delivery/notification-sent.event.js";
import { EmailSet } from "#src/notification/set-email/email-set.event.js";

const { call, given, streamed, succeed, then, when } = Story;

const feed = Feed.ref("tenant-1");
const sam = Recipient.ref("user-1");
const address = "sam@example.com";

const invoicePaid = {
  audience: ["user-1"],
  id: "event-1",
  occurredAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
  payload: { amount: 4200, invoiceId: "invoice-7" },
  type: "invoice.paid",
};

const notification = { kind: "invoice.paid", notificationId: "event-1", payload: invoicePaid.payload };

const publishInvoicePaid = when(feed, Publish.make({ event: invoicePaid }), { commandId: invoicePaid.id });

const publishedToSam = [
  given(sam, EmailSet.make({ address })),
  publishInvoicePaid,
  then(feed, Published.make({ event: invoicePaid, position: 1, tenant: feed.id })),
  streamed(PublicEvents, feed, FeedEntry.make({ event: invoicePaid, position: 1 })),
] as const satisfies readonly Step[];

const pushed = ({
  messageId,
  notificationId,
  token,
}: {
  readonly messageId: string;
  readonly notificationId: string;
  readonly token: string;
}): readonly Step[] => [
  call(Push.send, {
    body: "Invoice paid. Open the app to see the details.",
    idempotencyKey: `${notificationId}:${sam.id}:push:${token}`,
    title: "Invoice paid",
    token,
  }),
  succeed(Push.send, { messageId }),
  then(sam, NotificationSent.make({ channel: "push", messageId, notificationId, to: token })),
];

export { address, feed, notification, publishedToSam, publishInvoicePaid, pushed, sam };
