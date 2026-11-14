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

const feed = Feed.ref("tenant-1");
const endpointId = EndpointId.make("endpoint-1");
const endpoints = Endpoints.ref("tenant-1");
const delivery = Delivery.ref("endpoint-1:event-1");
const url = "https://receiver.example.com/hooks";

const invoicePaid = {
  audience: [],
  id: "event-1",
  occurredAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
  payload: { invoiceId: "invoice-7" },
  type: "invoice.paid",
};

const attempt = { endpointId, event: invoicePaid, position: 1, url };

const registered = given(endpoints, EndpointRegistered.make({ endpointId, eventTypes: ["invoice.paid"], url }));

const published = [
  registered,
  when(feed, Publish.make({ event: invoicePaid }), { commandId: invoicePaid.id }),
  then(feed, Published.make({ event: invoicePaid, position: 1, tenant: feed.id })),
  then(delivery, DeliveryStarted.make({ endpointId, event: invoicePaid, position: 1, tenant: feed.id, url })),
] as const satisfies readonly Step[];

const invoicePaidAgain = { ...invoicePaid, id: "event-2" };

const publishedAgain = [
  when(feed, Publish.make({ event: invoicePaidAgain }), { commandId: invoicePaidAgain.id }),
  then(feed, Published.make({ event: invoicePaidAgain, position: 2, tenant: feed.id })),
  then(Delivery.ref("endpoint-1:event-2")),
] as const satisfies readonly Step[];

export { attempt, delivery, endpointId, endpoints, published, publishedAgain, registered };
