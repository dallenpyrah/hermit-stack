import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { EndpointId } from "#src/webhook/endpoint.id.js";

class EndpointDisabled extends Event("EndpointDisabled", {
  endpointId: EndpointId,
  reason: Schema.Literals(["gone", "failing"]),
}) {}

export { EndpointDisabled };
