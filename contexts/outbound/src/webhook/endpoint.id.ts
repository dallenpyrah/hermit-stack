import { Schema } from "effect";

const EndpointId = Schema.String.pipe(Schema.brand("EndpointId"));

type EndpointId = typeof EndpointId.Type;

export { EndpointId };
