import { Command } from "@alchemy.run/domain";
import { Function as Fn, Match, Schema } from "effect";

import { AttemptStarted } from "#src/webhook/attempt-delivery/attempt-started.event.js";
import { DeliveryId } from "#src/webhook/delivery.id.js";
import type { DeliveryState } from "#src/webhook/delivery-state.schema.js";

class AttemptDelivery extends Command(
  "AttemptDelivery",
  { events: [AttemptStarted], input: { attempt: Schema.Int }, target: DeliveryId },
  { description: "A retry of a webhook delivery is due." },
) {}

const decideArity = 2;

const decideAttemptDelivery: {
  (command: AttemptDelivery): (state: DeliveryState) => readonly AttemptStarted[];
  (state: DeliveryState, command: AttemptDelivery): readonly AttemptStarted[];
} = Fn.dual(decideArity, (state: DeliveryState, command: AttemptDelivery): readonly AttemptStarted[] =>
  Match.valueTags(state, {
    Fresh: () => [],
    Posting: () => [],
    Settled: () => [],
    Waiting: (waiting) => {
      if (waiting.attempt !== command.attempt) {
        return [];
      }

      return [AttemptStarted.make({ attempt: command.attempt })];
    },
  }),
);

export { AttemptDelivery, decideAttemptDelivery };
