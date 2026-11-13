import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { EndpointId } from "#src/webhook/endpoint.id.js";

class EndpointRegistered extends Event("EndpointRegistered", {
  endpointId: EndpointId,
  eventTypes: Schema.Array(Schema.String),
  url: Schema.String,
}) {}

export { EndpointRegistered };
