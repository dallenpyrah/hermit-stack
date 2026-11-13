import { Policy } from "@alchemy.run/domain";
import { Effect, Match } from "effect";

import { AttemptStarted } from "#src/webhook/attempt-delivery/attempt-started.event.js";
import { Delivery } from "#src/webhook/delivery.aggregate.js";
import { Responded, Unreachable } from "#src/webhook/record-attempt/attempt-outcome.schema.js";
import { RecordAttempt } from "#src/webhook/record-attempt/record-attempt.command.js";
import { DeliveryStarted } from "#src/webhook/start-delivery/delivery-started.event.js";
import { WebhookTransport } from "#src/webhook/webhook-transport.external.js";

class PostDelivery extends Policy(
  "PostDelivery",
  { from: Delivery, on: [DeliveryStarted, AttemptStarted] },
  { description: "Posts a delivery's event to its endpoint for each attempt, and records the answer." },
) {}

const PostDeliveryLive = PostDelivery.toLayer(
  Effect.gen(function* postDeliveryLive() {
    const deliveries = yield* Delivery;
    const transport = yield* WebhookTransport;

    return Effect.fn("PostDelivery.handle")(function* handle({ source }) {
      const state = yield* deliveries.get(source);

      // A repeat of an event whose attempt is already answered finds the delivery past Posting and posts nothing.
      yield* Match.valueTags(state, {
        Fresh: () => Effect.void,
        Posting: (posting) =>
          transport
            .post({
              endpointId: posting.endpointId,
              event: posting.event,
              position: posting.position,
              url: posting.url,
            })
            .pipe(
              Effect.map((response) => Responded.make(response)),
              Effect.catchTag("TransportFailed", (failed) =>
                Effect.succeed(Unreachable.make({ reason: failed.reason })),
              ),
              Effect.flatMap((outcome) =>
                deliveries.send(source, RecordAttempt.make({ attempt: posting.attempt, outcome })),
              ),
            ),
        Settled: () => Effect.void,
        Waiting: () => Effect.void,
      });
    });
  }),
);

export { PostDelivery, PostDeliveryLive };
