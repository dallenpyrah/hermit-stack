import { Policy } from "@alchemy.run/domain";
import { Effect, Match } from "effect";

import { Email } from "#src/notification/email.external.js";
import { renderNotification } from "#src/notification/notification-template.pure.js";
import { NotificationQueued } from "#src/notification/notify/notification-queued.event.js";
import { Push } from "#src/notification/push.external.js";
import { Recipient } from "#src/notification/recipient.aggregate.js";
import { Accepted, Refused } from "#src/notification/record-delivery/delivery-result.schema.js";
import { RecordDelivery } from "#src/notification/record-delivery/record-delivery.command.js";

class DispatchNotification extends Policy(
  "DispatchNotification",
  { from: Recipient, on: [NotificationQueued] },
  { description: "Sends each queued email and push notification through its vendor and records the answer." },
) {}

const DispatchNotificationLive = DispatchNotification.toLayer(
  Effect.gen(function* dispatchNotificationLive() {
    const recipients = yield* Recipient;
    const email = yield* Email;
    const push = yield* Push;

    return Effect.fn("DispatchNotification.handle")(function* handle({ event, source }) {
      const { channel } = event;

      if (channel === "inbox") {
        return;
      }

      const { body, title } = renderNotification(event.kind);
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

export { DispatchNotification, DispatchNotificationLive };
