import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { EndpointId } from "#src/webhook/endpoint.id.js";

class FailureCounted extends Event("FailureCounted", { endpointId: EndpointId, failuresInRow: Schema.Int }) {}

export { FailureCounted };
