import { Aggregate } from "@alchemy.run/domain";

import { FeedState } from "#src/feed/feed-state.schema.js";
import { decidePublish, Publish } from "#src/feed/publish/publish.command.js";
import { TenantId } from "#src/feed/tenant.id.js";

// A tenant's public events in the order they were published. Everything outbound sends starts from a Published.
class Feed extends Aggregate(
  "Feed",
  {
    commands: [Publish],
    decide: {
      Publish: (state, command, { id }) => decidePublish(state, command, id),
    },
    evolve: {
      Published: (_state, event) => ({ published: event.position }),
    },
    id: TenantId,
    initial: { published: 0 },
    state: FeedState,
  },
  { description: "A tenant's feed of public events." },
) {}

export { Feed };
