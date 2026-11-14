import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { PublicEvent } from "#src/feed/public-event.schema.js";
import { TenantId } from "#src/feed/tenant.id.js";

// Position is the event's place in its tenant's feed, starting at 1, so a receiver can order what it was sent.
class Published extends Event("Published", { event: PublicEvent, position: Schema.Int, tenant: TenantId }) {}

export { Published };
