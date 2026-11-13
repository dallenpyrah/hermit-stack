import { Policy } from "@alchemy.run/domain";
import { Array as Arr, Effect, Match, Number as Num } from "effect";

import { Feed } from "#src/feed/feed.aggregate.js";
import { Published } from "#src/feed/feed.command.js";
import { Delivery } from "#src/webhook/delivery.aggregate.js";
import {
  Abandoned,
  AttemptDelivery,
  AttemptFailed,
  AttemptStarted,
  Delivered,
  DeliveryStarted,
  Exhausted,
  RecordAttempt,
  Responded,
  StartDelivery,
  Unreachable,
} from "#src/webhook/delivery.command.js";
import { DeliveryId } from "#src/webhook/delivery.id.js";
import { Endpoints } from "#src/webhook/endpoints.aggregate.js";
import { RecordDeliveryOutcome } from "#src/webhook/endpoints.command.js";
import { WebhookTransport } from "#src/webhook/webhook-transport.external.js";

// Bounds how many deliveries one public event starts at once.
const startConcurrency = 8;

const StartDeliveries = Policy(
  "StartDeliveries",
  { from: Feed, on: [Published] },
  { description: "Starts a delivery to every active endpoint of the tenant that takes the event's type." },
);

// The endpoints are read from the tenant's Endpoints aggregate as of its latest commit, so an endpoint registered a
// Moment after the event misses it, and the receiver reads it from the feed instead.
const StartDeliveriesLive = StartDeliveries.toLayer(
  Effect.gen(function* startDeliveriesLive() {
    const endpoints = yield* Endpoints;
    const deliveries = yield* Delivery;

    return Effect.fn("StartDeliveries.handle")(function* handle({ event }) {
      const { endpoints: registered } = yield* endpoints.get(event.tenant);

      const receiving = Arr.filter(
        registered,
        (endpoint) => endpoint.active && Arr.contains(endpoint.eventTypes, event.event.type),
      );

      yield* Effect.forEach(
        receiving,
        (endpoint) => {
          const deliveryId = DeliveryId.make(`${endpoint.endpointId}:${event.event.id}`);

          const start = StartDelivery.make({
            endpointId: endpoint.endpointId,
            event: event.event,
            position: event.position,
            tenant: event.tenant,
            url: endpoint.url,
          });

          return deliveries.send(deliveryId, start, { commandId: deliveryId });
        },
        { concurrency: startConcurrency, discard: true },
      );
    });
  }),
);

const PostDelivery = Policy(
  "PostDelivery",
  { from: Delivery, on: [DeliveryStarted, AttemptStarted] },
  { description: "Posts a delivery's event to its endpoint for each attempt, and records the answer." },
);

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

const ScheduleRetry = Policy(
  "ScheduleRetry",
  { from: Delivery, on: [AttemptFailed] },
  { description: "Schedules the next attempt of a failed webhook delivery at the time it recorded." },
);

const ScheduleRetryLive = ScheduleRetry.toLayer(
  Effect.gen(function* scheduleRetryLive() {
    const deliveries = yield* Delivery;

    return Effect.fn("ScheduleRetry.handle")(function* handle({ event, source }) {
      // One name per delivery, so a delivery never has two retries waiting.
      yield* deliveries.schedule(source, AttemptDelivery.make({ attempt: Num.increment(event.attempt) }), {
        at: event.retryAt,
        commandId: `retry:${source.id}`,
      });
    });
  }),
);

const TrackEndpointHealth = Policy(
  "TrackEndpointHealth",
  { from: Delivery, on: [Delivered, Exhausted, Abandoned] },
  { description: "Tells a delivery's endpoint how the delivery ended." },
);

const TrackEndpointHealthLive = TrackEndpointHealth.toLayer(
  Effect.gen(function* trackEndpointHealthLive() {
    const deliveries = yield* Delivery;
    const endpoints = yield* Endpoints;

    return Effect.fn("TrackEndpointHealth.handle")(function* handle({ source }) {
      const state = yield* deliveries.get(source);

      yield* Match.valueTags(state, {
        Fresh: () => Effect.void,
        Posting: () => Effect.void,
        Settled: (settled) =>
          endpoints.send(
            settled.tenant,
            RecordDeliveryOutcome.make({ endpointId: settled.endpointId, outcome: settled.outcome }),
          ),
        Waiting: () => Effect.void,
      });
    });
  }),
);

export {
  PostDelivery,
  PostDeliveryLive,
  ScheduleRetry,
  ScheduleRetryLive,
  StartDeliveries,
  StartDeliveriesLive,
  TrackEndpointHealth,
  TrackEndpointHealthLive,
};
