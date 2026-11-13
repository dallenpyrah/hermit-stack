import { Event } from "@alchemy.run/domain";

import { EndpointId } from "#src/webhook/endpoint.id.js";

class FailuresCleared extends Event("FailuresCleared", { endpointId: EndpointId }) {}

export { FailuresCleared };
