import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { EndpointId } from "#src/webhook/endpoint.id.js";

// Gone is the receiver's 410; failing is too many exhausted deliveries in a row.
class EndpointDisabled extends Event("EndpointDisabled", {
  endpointId: EndpointId,
  reason: Schema.Literals(["gone", "failing"]),
}) {}

export { EndpointDisabled };
