import { Command, Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { TenantId } from "#src/feed/tenant.id.js";
import { EndpointId } from "#src/webhook/endpoint.id.js";

const Registration = { endpointId: EndpointId, eventTypes: Schema.Array(Schema.String), url: Schema.String };

const EndpointRegistered = Event("EndpointRegistered", Registration);

type EndpointRegistered = typeof EndpointRegistered.Type;

// Registering an endpoint id again replaces its URL and event types and starts it afresh, which is also how a disabled
// Endpoint comes back. The signing secret is not an argument: events are kept for good, so the transport reads it
// Through its own port.
const RegisterEndpoint = Command(
  "RegisterEndpoint",
  { events: [EndpointRegistered], input: Registration, target: TenantId },
  { description: "Register a URL that receives the tenant's public events of the listed types." },
);

const FailureCounted = Event("FailureCounted", { endpointId: EndpointId, failuresInRow: Schema.Int });

type FailureCounted = typeof FailureCounted.Type;

const FailuresCleared = Event("FailuresCleared", { endpointId: EndpointId });

type FailuresCleared = typeof FailuresCleared.Type;

// Gone is the receiver's 410; failing is too many exhausted deliveries in a row.
const EndpointDisabled = Event("EndpointDisabled", {
  endpointId: EndpointId,
  reason: Schema.Literals(["gone", "failing"]),
});

type EndpointDisabled = typeof EndpointDisabled.Type;

const DeliveryOutcome = Schema.Literals(["delivered", "exhausted", "gone"]);

// Reports how a delivery ended, so it never rejects.
const RecordDeliveryOutcome = Command(
  "RecordDeliveryOutcome",
  {
    events: [FailureCounted, FailuresCleared, EndpointDisabled],
    input: { endpointId: EndpointId, outcome: DeliveryOutcome },
    target: TenantId,
  },
  { description: "Count how a delivery to an endpoint ended, and disable an endpoint that keeps failing." },
);

type RecordDeliveryOutcome = typeof RecordDeliveryOutcome.Type;

export {
  EndpointDisabled,
  EndpointRegistered,
  FailureCounted,
  FailuresCleared,
  RecordDeliveryOutcome,
  RegisterEndpoint,
};
