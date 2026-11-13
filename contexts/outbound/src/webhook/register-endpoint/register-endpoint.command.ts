import { Command } from "@alchemy.run/domain";
import { Schema } from "effect";

import { TenantId } from "#src/feed/tenant.id.js";
import { EndpointId } from "#src/webhook/endpoint.id.js";
import { EndpointRegistered } from "#src/webhook/register-endpoint/endpoint-registered.event.js";

// Registering an endpoint id again replaces its URL and event types and starts it afresh, which is also how a disabled
// Endpoint comes back. The signing secret is not an argument: events are kept for good, so the transport reads it
// Through its own port.
class RegisterEndpoint extends Command(
  "RegisterEndpoint",
  {
    events: [EndpointRegistered],
    input: { endpointId: EndpointId, eventTypes: Schema.Array(Schema.String), url: Schema.String },
    target: TenantId,
  },
  { description: "Register a URL that receives the tenant's public events of the listed types." },
) {}

const decideRegisterEndpoint = (command: RegisterEndpoint): readonly EndpointRegistered[] => [
  EndpointRegistered.make({ endpointId: command.endpointId, eventTypes: command.eventTypes, url: command.url }),
];

export { decideRegisterEndpoint, RegisterEndpoint };
