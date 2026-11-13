import { Schema } from "effect";

import { EndpointId } from "#src/webhook/endpoint.id.js";

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

export { Endpoint, EndpointsState, noFailures };
