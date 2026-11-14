import { Policy } from "@alchemy.run/domain";
import { Array as Arr, Effect } from "effect";

import { Feed } from "#src/feed/feed.aggregate.js";
import { Published } from "#src/feed/publish/published.event.js";
import { Delivery } from "#src/webhook/delivery.aggregate.js";
import { DeliveryId } from "#src/webhook/delivery.id.js";
import { Endpoints } from "#src/webhook/endpoints.aggregate.js";
import { StartDelivery } from "#src/webhook/start-delivery/start-delivery.command.js";

const startConcurrency = 8;

class StartDeliveries extends Policy(
  "StartDeliveries",
  { from: Feed, on: [Published] },
  { description: "Starts a delivery to every active endpoint of the tenant that takes the event's type." },
) {}

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

export { StartDeliveries, StartDeliveriesLive };
