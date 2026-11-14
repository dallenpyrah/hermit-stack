import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { PublicEvent } from "#src/feed/public-event.schema.js";
import { TenantId } from "#src/feed/tenant.id.js";

class Published extends Event("Published", { event: PublicEvent, position: Schema.Int, tenant: TenantId }) {}

export { Published };
