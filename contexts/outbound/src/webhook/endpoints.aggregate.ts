import { Aggregate } from "@alchemy.run/domain";
import { Array as Arr } from "effect";

import { TenantId } from "#src/feed/tenant.id.js";
import type { EndpointId } from "#src/webhook/endpoint.id.js";
import { Endpoint, EndpointsState, noFailures } from "#src/webhook/endpoints-state.schema.js";
import {
  decideRecordDeliveryOutcome,
  RecordDeliveryOutcome,
} from "#src/webhook/record-outcome/record-delivery-outcome.command.js";
import { decideRegisterEndpoint, RegisterEndpoint } from "#src/webhook/register-endpoint/register-endpoint.command.js";

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

// A tenant's webhook endpoints in one instance, so finding who receives a public event is one read of decided state
// And not a query across instances. Each command's rule lives in its own file beside its events; this file holds the
// State and how events change it.
class Endpoints extends Aggregate(
  "Endpoints",
  {
    commands: [RegisterEndpoint, RecordDeliveryOutcome],
    decide: {
      RecordDeliveryOutcome: decideRecordDeliveryOutcome,
      RegisterEndpoint: (_state, command) => decideRegisterEndpoint(command),
    },
    evolve: {
      EndpointDisabled: (state, event) =>
        updateEndpoint(state, event.endpointId, (endpoint) => ({ ...endpoint, active: false })),
      // A registration replaces the endpoint with that id and starts it afresh: active, with no failures.
      EndpointRegistered: (state, event) => ({
        endpoints: [
          ...Arr.filter(state.endpoints, (registered) => registered.endpointId !== event.endpointId),
          Endpoint.make({
            active: true,
            endpointId: event.endpointId,
            eventTypes: event.eventTypes,
            failuresInRow: noFailures,
            url: event.url,
          }),
        ],
      }),
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
