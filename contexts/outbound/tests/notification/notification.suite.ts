import { Story } from "@alchemy.run/domain/Story";
import type { Step } from "@alchemy.run/domain/Story";
import { DateTime } from "effect";

import { Feed } from "#src/feed/feed.aggregate.js";
import { Publish } from "#src/feed/publish/publish.command.js";
import { Published } from "#src/feed/publish/published.event.js";
import { FeedEntry, PublicEvents } from "#src/feed/public-events.projection.js";
import { Recipient } from "#src/notification/recipient.aggregate.js";
import { EmailSet } from "#src/notification/set-email/email-set.event.js";

const { given, streamed, then, when } = Story;

const feed = Feed.ref("tenant-1");
const sam = Recipient.ref("user-1");
const address = "sam@example.com";

// An example of what another context would publish: an invoice was paid, and its owner should hear about it.
const invoicePaid = {
  audience: ["user-1"],
  id: "event-1",
  occurredAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
  payload: { amount: 4200, invoiceId: "invoice-7" },
  type: "invoice.paid",
};

const notification = { kind: "invoice.paid", notificationId: "event-1", payload: invoicePaid.payload };

const publishInvoicePaid = when(feed, Publish.make({ event: invoicePaid }), { commandId: invoicePaid.id });

// Sam has an email address, the event is published, and it reaches the feed and the public stream.
const publishedToSam = [
  given(sam, EmailSet.make({ address })),
  publishInvoicePaid,
  then(feed, Published.make({ event: invoicePaid, position: 1, tenant: feed.id })),
  streamed(PublicEvents, feed, FeedEntry.make({ event: invoicePaid, position: 1 })),
] as const satisfies readonly Step[];

export { address, feed, notification, publishedToSam, publishInvoicePaid, sam };
