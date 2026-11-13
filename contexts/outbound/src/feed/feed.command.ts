import { Command, Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { PublicEvent } from "#src/feed/public-event.schema.js";
import { TenantId } from "#src/feed/tenant.id.js";

// Position is the event's place in its tenant's feed, starting at 1, so a receiver can order what it was sent.
const Published = Event("Published", { event: PublicEvent, position: Schema.Int, tenant: TenantId });

type Published = typeof Published.Type;

// Send it with the public event's id as the command id, so a publisher that runs twice publishes once.
const Publish = Command(
  "Publish",
  { events: [Published], input: { event: PublicEvent }, target: TenantId },
  { description: "Add a public event to its tenant's feed." },
);

type Publish = typeof Publish.Type;

export { Publish, Published };
