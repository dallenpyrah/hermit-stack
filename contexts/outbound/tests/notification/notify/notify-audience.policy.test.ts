import { Story } from "@alchemy.run/domain/Story";
import type { StoryFailure } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import type { Effect } from "effect";

import { Email } from "#src/notification/email.external.js";
import { Inbox } from "#src/notification/inbox.view.js";
import { NotificationQueued } from "#src/notification/notify/notification-queued.event.js";
import { NotificationSent } from "#src/notification/record-delivery/notification-sent.event.js";
import {
  address,
  feed,
  notification,
  publishedToSam,
  publishInvoicePaid,
  sam,
} from "#tests/notification/notification.suite";
import { outboundStory } from "#tests/outbound.suite";

const { call, returned, then, view } = Story;

const reachesInboxAndEmailOnce = (): Effect.Effect<void, StoryFailure> =>
  outboundStory(
    ...publishedToSam,
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
    publishInvoicePaid,
    then(feed),
    then(sam),
  );

describe("a public event with a user in its audience", () => {
  it.effect("reaches the user's inbox and is sent through the email port once", reachesInboxAndEmailOnce);
});
