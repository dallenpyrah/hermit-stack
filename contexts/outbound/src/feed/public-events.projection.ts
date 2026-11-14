import { Event, Projection, Stream } from "@alchemy.run/domain";
import { Effect, Schema } from "effect";

import { Feed } from "#src/feed/feed.aggregate.js";
import { Published } from "#src/feed/publish/published.event.js";
import { PublicEvent } from "#src/feed/public-event.schema.js";

const FeedEntry = Event("FeedEntry", { event: PublicEvent, position: Schema.Int });

// The feed a customer reads from the last position it saw, so a lost webhook is recovered without a resend.
// Declared beside its one writer because the structure rules do not let a projection import a .stream file.
const PublicEvents = Stream(
  "PublicEvents",
  { entries: [FeedEntry], key: Feed },
  { description: "A tenant's public events, in feed order." },
);

class WritePublicEvents extends Projection(
  "WritePublicEvents",
  { from: [Feed], key: Feed, on: [Published], writes: [PublicEvents] },
  { description: "Appends every published event to its tenant's PublicEvents stream." },
) {}

const WritePublicEventsLive = WritePublicEvents.toLayer(
  Effect.gen(function* writePublicEventsLive() {
    const stream = yield* PublicEvents;

    return Effect.fn("WritePublicEvents.handle")(function* handle(batch) {
      yield* Effect.forEach(
        batch,
        (input) => stream.append(input, FeedEntry.make({ event: input.event.event, position: input.event.position })),
        { discard: true },
      );
    });
  }),
);

export { FeedEntry, PublicEvents, WritePublicEvents, WritePublicEventsLive };
