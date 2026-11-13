import { Story } from "@alchemy.run/domain/Story";
import type { Step } from "@alchemy.run/domain/Story";
import { DateTime } from "effect";

import { Feed } from "#src/feed/feed.aggregate.js";
import { Publish } from "#src/feed/publish/publish.command.js";
import { Published } from "#src/feed/publish/published.event.js";
import { Delivery } from "#src/webhook/delivery.aggregate.js";
import { EndpointId } from "#src/webhook/endpoint.id.js";
import { Endpoints } from "#src/webhook/endpoints.aggregate.js";
import { EndpointRegistered } from "#src/webhook/register-endpoint/endpoint-registered.event.js";
import { DeliveryStarted } from "#src/webhook/start-delivery/delivery-started.event.js";

const { given, then, when } = Story;

// The tenant every story publishes for, and the one webhook endpoint it registers.
const feed = Feed.ref("tenant-1");
const endpointId = EndpointId.make("endpoint-1");
const endpoints = Endpoints.ref("tenant-1");
const delivery = Delivery.ref("endpoint-1:event-1");
const url = "https://receiver.example.com/hooks";

// An example of what another context would publish, with nobody to notify, so only the webhook path runs.
const invoicePaid = {
  audience: [],
  id: "event-1",
  occurredAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
  payload: { invoiceId: "invoice-7" },
  type: "invoice.paid",
};

// What every attempt sends to the transport. A story follows the steps below with this call, then answers it.
const attempt = { endpointId, event: invoicePaid, position: 1, url };

// Registers the endpoint, publishes the event and starts the delivery.
const published = [
  given(endpoints, EndpointRegistered.make({ endpointId, eventTypes: ["invoice.paid"], url })),
  when(feed, Publish.make({ event: invoicePaid }), { commandId: invoicePaid.id }),
  then(feed, Published.make({ event: invoicePaid, position: 1, tenant: feed.id })),
  then(delivery, DeliveryStarted.make({ endpointId, event: invoicePaid, position: 1, tenant: feed.id, url })),
] as const satisfies readonly Step[];

export { attempt, delivery, endpointId, endpoints, published };
