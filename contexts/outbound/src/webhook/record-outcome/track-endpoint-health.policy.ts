import { Policy } from "@alchemy.run/domain";
import { Effect, Match } from "effect";

import { Delivery } from "#src/webhook/delivery.aggregate.js";
import { Endpoints } from "#src/webhook/endpoints.aggregate.js";
import { Abandoned } from "#src/webhook/record-attempt/abandoned.event.js";
import { Delivered } from "#src/webhook/record-attempt/delivered.event.js";
import { Exhausted } from "#src/webhook/record-attempt/exhausted.event.js";
import { RecordDeliveryOutcome } from "#src/webhook/record-outcome/record-delivery-outcome.command.js";

class TrackEndpointHealth extends Policy(
  "TrackEndpointHealth",
  { from: Delivery, on: [Delivered, Exhausted, Abandoned] },
  { description: "Tells a delivery's endpoint how the delivery ended." },
) {}

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

export { TrackEndpointHealth, TrackEndpointHealthLive };
