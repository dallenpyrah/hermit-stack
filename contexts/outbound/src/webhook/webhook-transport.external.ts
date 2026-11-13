import { ExternalSystem, Rejection } from "@alchemy.run/domain";
import { Schema } from "effect";

import { PublicEvent } from "#src/feed/public-event.schema.js";
import { EndpointId } from "#src/webhook/endpoint.id.js";

// No HTTP answer came: a timeout, a refused connection, or an address the transport will not call.
const TransportFailed = Rejection("TransportFailed", { reason: Schema.String });

// The adapter signs the body with the endpoint's secret, sends the event id as webhook-id so a receiver can drop
// Repeats, refuses private and loopback addresses, and follows no redirects.
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
