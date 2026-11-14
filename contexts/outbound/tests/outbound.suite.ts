import { Story } from "@alchemy.run/domain/Story";
import { Layer } from "effect";

import { Push } from "#src/notification/push.external.js";
import { OutboundHandlers } from "#src/outbound.layer.js";
import { Outbound } from "#src/outbound.model.js";
import { WebhookTransport } from "#src/webhook/webhook-transport.external.js";
import { EmailFake } from "#tests/notification/email.fake";

const outboundStory = Story.make(Outbound, {
  layer: OutboundHandlers.pipe(Layer.provide(EmailFake)),
  stub: [Push, WebhookTransport],
});

export { outboundStory };
