import { Schema } from "effect";

import { PublicEvent } from "#src/feed/public-event.schema.js";
import { TenantId } from "#src/feed/tenant.id.js";
import { EndpointId } from "#src/webhook/endpoint.id.js";

const DeliveryTarget = Schema.Struct({
  endpointId: EndpointId,
  event: PublicEvent,
  position: Schema.Int,
  tenant: TenantId,
  url: Schema.String,
});

type DeliveryTarget = typeof DeliveryTarget.Type;

export { DeliveryTarget };
