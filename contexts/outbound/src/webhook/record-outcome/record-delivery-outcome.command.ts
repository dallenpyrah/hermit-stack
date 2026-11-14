import { Command } from "@alchemy.run/domain";
import { Array as Arr, Function as Fn, Match, Number as Num, Option } from "effect";

import { TenantId } from "#src/feed/tenant.id.js";
import { DeliveryOutcome } from "#src/webhook/delivery-state.schema.js";
import { EndpointId } from "#src/webhook/endpoint.id.js";
import { noFailures } from "#src/webhook/endpoints-state.schema.js";
import type { Endpoint, EndpointsState } from "#src/webhook/endpoints-state.schema.js";
import { EndpointDisabled } from "#src/webhook/record-outcome/endpoint-disabled.event.js";
import { FailureCounted } from "#src/webhook/record-outcome/failure-counted.event.js";
import { FailuresCleared } from "#src/webhook/record-outcome/failures-cleared.event.js";

class RecordDeliveryOutcome extends Command(
  "RecordDeliveryOutcome",
  {
    events: [FailureCounted, FailuresCleared, EndpointDisabled],
    input: { endpointId: EndpointId, outcome: DeliveryOutcome },
    target: TenantId,
  },
  { description: "Count how a delivery to an endpoint ended, and disable an endpoint that keeps failing." },
) {}

type OutcomeEvent = EndpointDisabled | FailureCounted | FailuresCleared;

const disableAfterFailures = 5;

const countFailure = (endpoint: Endpoint): readonly OutcomeEvent[] => {
  const failuresInRow = Num.increment(endpoint.failuresInRow);
  const counted = FailureCounted.make({ endpointId: endpoint.endpointId, failuresInRow });

  if (failuresInRow >= disableAfterFailures) {
    return [counted, EndpointDisabled.make({ endpointId: endpoint.endpointId, reason: "failing" })];
  }

  return [counted];
};

const clearFailures = (endpoint: Endpoint): readonly OutcomeEvent[] => {
  if (endpoint.failuresInRow === noFailures) {
    return [];
  }

  return [FailuresCleared.make({ endpointId: endpoint.endpointId })];
};

const decideArity = 2;

const decideRecordDeliveryOutcome: {
  (command: RecordDeliveryOutcome): (state: EndpointsState) => readonly OutcomeEvent[];
  (state: EndpointsState, command: RecordDeliveryOutcome): readonly OutcomeEvent[];
} = Fn.dual(decideArity, (state: EndpointsState, command: RecordDeliveryOutcome): readonly OutcomeEvent[] =>
  Option.match(
    Arr.findFirst(state.endpoints, (endpoint) => endpoint.endpointId === command.endpointId && endpoint.active),
    {
      onNone: () => [],
      onSome: (endpoint) =>
        Match.value(command.outcome).pipe(
          Match.when("delivered", () => clearFailures(endpoint)),
          Match.when("exhausted", () => countFailure(endpoint)),
          Match.when("gone", () => [EndpointDisabled.make({ endpointId: endpoint.endpointId, reason: "gone" })]),
          Match.exhaustive,
        ),
    },
  ),
);

export { decideRecordDeliveryOutcome, RecordDeliveryOutcome };
