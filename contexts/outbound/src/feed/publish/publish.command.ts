import { Command } from "@alchemy.run/domain";
import { Function as Fn, Number as Num } from "effect";

import type { FeedState } from "#src/feed/feed-state.schema.js";
import { PublicEvent } from "#src/feed/public-event.schema.js";
import { Published } from "#src/feed/publish/published.event.js";
import { TenantId } from "#src/feed/tenant.id.js";

class Publish extends Command(
  "Publish",
  { events: [Published], input: { event: PublicEvent }, target: TenantId },
  { description: "Add a public event to its tenant's feed." },
) {}

const decideArity = 3;

const publish = (state: FeedState, command: Publish, tenant: TenantId): readonly Published[] => [
  Published.make({ event: command.event, position: Num.increment(state.published), tenant }),
];

const decidePublish: {
  (command: Publish, tenant: TenantId): (state: FeedState) => readonly Published[];
  (state: FeedState, command: Publish, tenant: TenantId): readonly Published[];
} = Fn.dual(decideArity, publish);

export { decidePublish, Publish };
