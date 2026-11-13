import { Story } from "@alchemy.run/domain/Story";
import type { StoryFailure } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { Effect } from "effect";

import { Publish, Published } from "#src/feed/feed.command.js";
import { FeedEntry, PublicEvents } from "#src/feed/public-events.projection.js";
import { Email } from "#src/notification/email.external.js";
import { Inbox } from "#src/notification/inbox.view.js";
import { Recipient } from "#src/notification/recipient.aggregate.js";
import { EmailSet, NotificationQueued, NotificationSent } from "#src/notification/recipient.command.js";
import { feed, outboundStory } from "#tests/outbound.suite";

const { call, given, returned, streamed, then, view, when } = Story;

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

const publish = Publish.make({ event: invoicePaid });
const notification = { kind: "invoice.paid", notificationId: "event-1", payload: invoicePaid.payload };

const reachesInboxAndEmailOnce = (): Effect.Effect<void, StoryFailure> =>
  outboundStory(
    given(sam, EmailSet.make({ address })),
    when(feed, publish, { commandId: invoicePaid.id }),
    then(feed, Published.make({ event: invoicePaid, position: 1, tenant: feed.id })),
    streamed(PublicEvents, feed, FeedEntry.make({ event: invoicePaid, position: 1 })),
    then(
      sam,
      NotificationQueued.make({ ...notification, channel: "inbox", to: "user-1" }),
      NotificationQueued.make({ ...notification, channel: "email", to: address }),
    ),
    view(Inbox, sam, { items: [{ ...notification, read: false }], unread: 1 }),
    call(Email.send, {
      idempotencyKey: `event-1:user-1:email:${address}`,
      subject: "Invoice paid",
      text: "Invoice paid. Open the app to see the details.",
      to: address,
    }),
    returned(Email.send, { messageId: "email-1" }),
    then(
      sam,
      NotificationSent.make({ channel: "email", messageId: "email-1", notificationId: "event-1", to: address }),
    ),
    // The publisher runs again for the same event: the feed keeps one copy, and nobody is told twice.
    when(feed, publish, { commandId: invoicePaid.id }),
    then(feed),
    then(sam),
  );

describe("a public event with a user in its audience", () => {
  it.effect("reaches the user's inbox and is sent through the email port once", reachesInboxAndEmailOnce);
});
