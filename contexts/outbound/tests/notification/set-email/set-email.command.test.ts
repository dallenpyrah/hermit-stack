import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { Email } from "#src/notification/email.external.js";
import { NotificationQueued } from "#src/notification/notify/notification-queued.event.js";
import { Notify } from "#src/notification/notify/notify.command.js";
import { NotificationSent } from "#src/notification/record-delivery/notification-sent.event.js";
import { EmailSet } from "#src/notification/set-email/email-set.event.js";
import { SetEmail } from "#src/notification/set-email/set-email.command.js";
import { notification, sam } from "#tests/notification/notification.suite";
import { outboundStory } from "#tests/outbound.suite";

const { call, returned, then, when } = Story;

type Case = () => ReturnType<typeof outboundStory>;

const first = "sam@example.com";
const second = "sam@work.example.com";

const sendsToTheLatestAddress: Case = () =>
  outboundStory(
    when(sam, SetEmail.make({ address: first })),
    then(sam, EmailSet.make({ address: first })),
    when(sam, SetEmail.make({ address: first })),
    then(sam),
    when(sam, SetEmail.make({ address: second })),
    then(sam, EmailSet.make({ address: second })),
    when(sam, Notify.make(notification)),
    then(
      sam,
      NotificationQueued.make({ ...notification, channel: "inbox", to: sam.id }),
      NotificationQueued.make({ ...notification, channel: "email", to: second }),
    ),
    call(Email.send, { idempotencyKey: `event-1:user-1:email:${second}`, to: second }),
    returned(Email.send, { messageId: "email-1" }),
    then(sam, NotificationSent.make({ channel: "email", messageId: "email-1", notificationId: "event-1", to: second })),
  );

describe("setting a recipient's email address", () => {
  it.effect("records only a change, and email goes to the latest address", sendsToTheLatestAddress);
});
