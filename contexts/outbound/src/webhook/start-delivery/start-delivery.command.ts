import { Command } from "@alchemy.run/domain";
import { Function as Fn, Match } from "effect";

import { DeliveryId } from "#src/webhook/delivery.id.js";
import type { DeliveryState } from "#src/webhook/delivery-state.schema.js";
import { DeliveryTarget } from "#src/webhook/delivery-target.schema.js";
import { DeliveryStarted } from "#src/webhook/start-delivery/delivery-started.event.js";

// Sent by a policy, so it never rejects: starting a delivery that already started records nothing.
class StartDelivery extends Command(
  "StartDelivery",
  { events: [DeliveryStarted], input: DeliveryTarget.fields, target: DeliveryId },
  { description: "Start delivering one public event to one webhook endpoint." },
) {}

const decideArity = 2;

const decideStartDelivery: {
  (command: StartDelivery): (state: DeliveryState) => readonly DeliveryStarted[];
  (state: DeliveryState, command: StartDelivery): readonly DeliveryStarted[];
} = Fn.dual(decideArity, (state: DeliveryState, command: StartDelivery): readonly DeliveryStarted[] =>
  Match.valueTags(state, {
    Fresh: () => [
      DeliveryStarted.make({
        endpointId: command.endpointId,
        event: command.event,
        position: command.position,
        tenant: command.tenant,
        url: command.url,
      }),
    ],
    Posting: () => [],
    Settled: () => [],
    Waiting: () => [],
  }),
);

export { decideStartDelivery, StartDelivery };
