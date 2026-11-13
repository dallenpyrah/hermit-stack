import { Aggregate } from "@alchemy.run/domain";
import { Array as Arr, Match, Number as Num, Option, Schema } from "effect";

import { TenantId } from "#src/feed/tenant.id.js";
import { EndpointId } from "#src/webhook/endpoint.id.js";
import {
  EndpointDisabled,
  EndpointRegistered,
  FailureCounted,
  FailuresCleared,
  RecordDeliveryOutcome,
  RegisterEndpoint,
} from "#src/webhook/endpoints.command.js";

// An endpoint whose deliveries are exhausted this many times in a row stops receiving deliveries.
const disableAfterFailures = 5;

const noFailures = 0;

const Endpoint = Schema.Struct({
  active: Schema.Boolean,
  endpointId: EndpointId,
  eventTypes: Schema.Array(Schema.String),
  failuresInRow: Schema.Int,
  url: Schema.String,
});

type Endpoint = typeof Endpoint.Type;

const EndpointsState = Schema.Struct({ endpoints: Schema.Array(Endpoint) });

type EndpointsState = typeof EndpointsState.Type;

type OutcomeEvent = EndpointDisabled | FailureCounted | FailuresCleared;

const findEndpoint = (state: EndpointsState, endpointId: EndpointId): Option.Option<Endpoint> =>
  Arr.findFirst(state.endpoints, (endpoint) => endpoint.endpointId === endpointId);

const updateEndpoint = (
  state: EndpointsState,
  endpointId: EndpointId,
  update: (endpoint: Endpoint) => Endpoint,
): EndpointsState => ({
  endpoints: Arr.map(state.endpoints, (endpoint) => {
    if (endpoint.endpointId === endpointId) {
      return update(endpoint);
    }

    return endpoint;
  }),
});

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

// A disabled or unknown endpoint ignores late outcomes, so a delivery still in flight when it was disabled changes
// Nothing.
const recordOutcome = (state: EndpointsState, command: RecordDeliveryOutcome): readonly OutcomeEvent[] =>
  Option.match(
    Option.filter(findEndpoint(state, command.endpointId), (endpoint) => endpoint.active),
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
  );

const register = (state: EndpointsState, event: EndpointRegistered): EndpointsState => {
  const endpoint = Endpoint.make({
    active: true,
    endpointId: event.endpointId,
    eventTypes: event.eventTypes,
    failuresInRow: noFailures,
    url: event.url,
  });

  const others = Arr.filter(state.endpoints, (registered) => registered.endpointId !== event.endpointId);

  return { endpoints: [...others, endpoint] };
};

// A tenant's webhook endpoints in one instance, so finding who receives a public event is one read of decided state
// And not a query across instances.
class Endpoints extends Aggregate(
  "Endpoints",
  {
    commands: [RegisterEndpoint, RecordDeliveryOutcome],
    decide: {
      RecordDeliveryOutcome: (state, command) => recordOutcome(state, command),
      RegisterEndpoint: (_state, command) => [
        EndpointRegistered.make({ endpointId: command.endpointId, eventTypes: command.eventTypes, url: command.url }),
      ],
    },
    evolve: {
      EndpointDisabled: (state, event) =>
        updateEndpoint(state, event.endpointId, (endpoint) => ({ ...endpoint, active: false })),
      EndpointRegistered: register,
      FailureCounted: (state, event) =>
        updateEndpoint(state, event.endpointId, (endpoint) => ({ ...endpoint, failuresInRow: event.failuresInRow })),
      FailuresCleared: (state, event) =>
        updateEndpoint(state, event.endpointId, (endpoint) => ({ ...endpoint, failuresInRow: noFailures })),
    },
    id: TenantId,
    initial: { endpoints: [] },
    state: EndpointsState,
  },
  { description: "A tenant's webhook endpoints: where each one sends, which event types it takes, and its health." },
) {}

export { Endpoints };
