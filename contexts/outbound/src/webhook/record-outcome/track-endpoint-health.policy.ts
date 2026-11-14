import { Policy } from "@alchemy.run/domain";
import { Effect, Predicate } from "effect";

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

      if (!Predicate.isTagged(state, "Settled")) {
        return;
      }

      yield* endpoints.send(
        state.tenant,
        RecordDeliveryOutcome.make({ endpointId: state.endpointId, outcome: state.outcome }),
      );
    });
  }),
);

export { TrackEndpointHealth, TrackEndpointHealthLive };
