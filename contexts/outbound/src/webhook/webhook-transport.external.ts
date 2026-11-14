import { ExternalSystem, Rejection } from "@alchemy.run/domain";
import { Schema } from "effect";

import { PublicEvent } from "#src/feed/public-event.schema.js";
import { EndpointId } from "#src/webhook/endpoint.id.js";

const TransportFailed = Rejection("TransportFailed", { reason: Schema.String });

class WebhookTransport extends ExternalSystem(
  "WebhookTransport",
  {
    post: {
      args: { endpointId: EndpointId, event: PublicEvent, position: Schema.Int, url: Schema.String },
      error: TransportFailed,
      success: { retryAfterSeconds: Schema.Option(Schema.Int), status: Schema.Int },
    },
  },
  { description: "Signs a public event and posts it to a webhook endpoint." },
) {}

export { TransportFailed, WebhookTransport };
