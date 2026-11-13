import { Aggregate } from "@alchemy.run/domain";
import { Number as Num, Schema } from "effect";

import { Publish, Published } from "#src/feed/feed.command.js";
import { TenantId } from "#src/feed/tenant.id.js";

const FeedState = Schema.Struct({ published: Schema.Int });

// A tenant's public events in the order they were published. Everything outbound sends starts from a Published.
class Feed extends Aggregate(
  "Feed",
  {
    commands: [Publish],
    decide: {
      Publish: (state, command, { id }) => [
        Published.make({ event: command.event, position: Num.increment(state.published), tenant: id }),
      ],
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
