import { Policy } from "@alchemy.run/domain";
import { Effect, Match } from "effect";

import { Feed } from "#src/feed/feed.aggregate.js";
import { Published } from "#src/feed/feed.command.js";
import { Email } from "#src/notification/email.external.js";
import { renderNotification } from "#src/notification/notification-template.pure.js";
import { Push } from "#src/notification/push.external.js";
import { Recipient } from "#src/notification/recipient.aggregate.js";
import { Accepted, NotificationQueued, Notify, RecordDelivery, Refused } from "#src/notification/recipient.command.js";
import { UserId } from "#src/notification/user.id.js";

// Bounds how many recipients one public event notifies at once.
const notifyConcurrency = 8;

const NotifyAudience = Policy(
  "NotifyAudience",
  { from: Feed, on: [Published] },
  { description: "Notifies every user in a public event's audience." },
);

const NotifyAudienceLive = NotifyAudience.toLayer(
  Effect.gen(function* notifyAudienceLive() {
    const recipients = yield* Recipient;

    return Effect.fn("NotifyAudience.handle")(function* handle({ event: { event } }) {
      yield* Effect.forEach(
        event.audience,
        (userId) =>
          recipients.send(
            UserId.make(userId),
            Notify.make({ kind: event.type, notificationId: event.id, payload: event.payload }),
            { commandId: `${event.id}:${userId}` },
          ),
        { concurrency: notifyConcurrency, discard: true },
      );
    });
  }),
);

const DispatchNotification = Policy(
  "DispatchNotification",
  { from: Recipient, on: [NotificationQueued] },
  { description: "Sends each queued email and push notification through its vendor and records the answer." },
);

const DispatchNotificationLive = DispatchNotification.toLayer(
  Effect.gen(function* dispatchNotificationLive() {
    const recipients = yield* Recipient;
    const email = yield* Email;
    const push = yield* Push;

    return Effect.fn("DispatchNotification.handle")(function* handle({ event, source }) {
      const { channel } = event;

      // The inbox is the Inbox view itself, so an inbox notification has nothing to send.
      if (channel === "inbox") {
        return;
      }

      const { body, title } = renderNotification(event.kind);
      // Derived from the event, so a dispatch that runs twice asks the vendor with the same key.
      const idempotencyKey = `${event.notificationId}:${source.id}:${channel}:${event.to}`;

      const result = yield* Match.value(channel).pipe(
        Match.when("email", () => email.send({ idempotencyKey, subject: title, text: body, to: event.to })),
        Match.when("push", () => push.send({ body, idempotencyKey, title, token: event.to })),
        Match.exhaustive,
        Effect.map((sent) => Accepted.make(sent)),
        Effect.catchTag(["Undeliverable", "DeviceGone"], (refused) =>
          Effect.succeed(Refused.make({ reason: refused.reason })),
        ),
      );

      yield* recipients.send(
        source,
        RecordDelivery.make({ channel, notificationId: event.notificationId, result, to: event.to }),
      );
    });
  }),
);

export { DispatchNotification, DispatchNotificationLive, NotifyAudience, NotifyAudienceLive };
