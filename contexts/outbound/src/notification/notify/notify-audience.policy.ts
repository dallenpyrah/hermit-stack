import { Policy } from "@alchemy.run/domain";
import { Effect } from "effect";

import { Feed } from "#src/feed/feed.aggregate.js";
import { Published } from "#src/feed/publish/published.event.js";
import { Notify } from "#src/notification/notify/notify.command.js";
import { Recipient } from "#src/notification/recipient.aggregate.js";
import { UserId } from "#src/notification/user.id.js";

const notifyConcurrency = 8;

class NotifyAudience extends Policy(
  "NotifyAudience",
  { from: Feed, on: [Published] },
  { description: "Notifies every user in a public event's audience." },
) {}

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

export { NotifyAudience, NotifyAudienceLive };
