import { Story } from "@alchemy.run/domain/Story";
import { Layer } from "effect";

import { Feed } from "#src/feed/feed.aggregate.js";
import { EmailFake } from "#src/notification/email.fake.js";
import { Push } from "#src/notification/push.external.js";
import { OutboundHandlers } from "#src/outbound.layer.js";
import { Outbound } from "#src/outbound.model.js";
import { EndpointId } from "#src/webhook/endpoint.id.js";
import { WebhookTransport } from "#src/webhook/webhook-transport.external.js";

// Email goes through the in-memory fake, so a story sees what it sent; a story answers each Push and webhook call.
const outboundStory = Story.make(Outbound, {
  layer: OutboundHandlers.pipe(Layer.provide(EmailFake)),
  stub: [Push, WebhookTransport],
});

// The tenant every story publishes for, and the one webhook endpoint it registers.
const feed = Feed.ref("tenant-1");

const endpointId = EndpointId.make("endpoint-1");

export { endpointId, feed, outboundStory };
