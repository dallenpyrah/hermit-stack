import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import { DateTime } from "effect";

import { Feed } from "#src/feed/feed.aggregate.js";
import { Publish } from "#src/feed/publish/publish.command.js";
import { Published } from "#src/feed/publish/published.event.js";
import { FeedEntry, PublicEvents } from "#src/feed/public-events.projection.js";
import { outboundStory } from "#tests/outbound.suite";

const { streamed, then, when } = Story;

type Case = () => ReturnType<typeof outboundStory>;

const feed = Feed.ref("tenant-1");

const occurredAt = DateTime.makeUnsafe("2026-01-01T00:00:00Z");
const first = { audience: [], id: "event-1", occurredAt, payload: { invoiceId: "invoice-7" }, type: "invoice.paid" };
const second = { audience: [], id: "event-2", occurredAt, payload: { invoiceId: "invoice-8" }, type: "invoice.paid" };

const numbersEachEvent: Case = () =>
  outboundStory(
    when(feed, Publish.make({ event: first }), { commandId: first.id }),
    then(feed, Published.make({ event: first, position: 1, tenant: feed.id })),
    streamed(PublicEvents, feed, FeedEntry.make({ event: first, position: 1 })),
    when(feed, Publish.make({ event: second }), { commandId: second.id }),
    then(feed, Published.make({ event: second, position: 2, tenant: feed.id })),
    streamed(PublicEvents, feed, FeedEntry.make({ event: second, position: 2 })),
  );

describe("publishing a public event", () => {
  it.effect("gives each event the next position in its tenant's feed", numbersEachEvent);
});
