import { Story } from "@alchemy.run/domain/Story";
import type { Step, StoryFailure } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import { Array as Arr, DateTime, Number as Num, Option } from "effect";
import type { Effect } from "effect";

import { Publish, Published } from "#src/feed/feed.command.js";
import { Delivery } from "#src/webhook/delivery.aggregate.js";
import { AttemptFailed, AttemptStarted, Delivered, DeliveryStarted, Exhausted } from "#src/webhook/delivery.command.js";
import { Endpoints } from "#src/webhook/endpoints.aggregate.js";
import { EndpointRegistered, FailureCounted } from "#src/webhook/endpoints.command.js";
import { TransportFailed, WebhookTransport } from "#src/webhook/webhook-transport.external.js";
import { endpointId, feed, outboundStory } from "#tests/outbound.suite";

const { call, clock, fail, given, succeed, then, when } = Story;

const endpoints = Endpoints.ref("tenant-1");
const delivery = Delivery.ref("endpoint-1:event-1");
const url = "https://receiver.example.com/hooks";
const tenMinutes = 600;

// An example of what another context would publish, with nobody to notify, so only the webhook path runs.
const invoicePaid = {
  audience: [],
  id: "event-1",
  occurredAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
  payload: { invoiceId: "invoice-7" },
  type: "invoice.paid",
};

const posted = call(WebhookTransport.post, { endpointId, event: invoicePaid, position: 1, url });

// Registers the endpoint, publishes the event and checks that the first attempt goes out.
const published: readonly Step[] = [
  given(endpoints, EndpointRegistered.make({ endpointId, eventTypes: ["invoice.paid"], url })),
  when(feed, Publish.make({ event: invoicePaid }), { commandId: invoicePaid.id }),
  then(feed, Published.make({ event: invoicePaid, position: 1, tenant: feed.id })),
  then(delivery, DeliveryStarted.make({ endpointId, event: invoicePaid, position: 1, tenant: feed.id, url })),
  posted,
];

interface Failure {
  readonly attempt: number;
  readonly reason: string;
  readonly retryAt: string;
}

const failedAt = (failure: Failure): AttemptFailed =>
  AttemptFailed.make({ ...failure, retryAt: DateTime.makeUnsafe(failure.retryAt) });

const retriedUntilDelivered = (): Effect.Effect<void, StoryFailure> =>
  outboundStory(
    ...published,
    succeed(WebhookTransport.post, { retryAfterSeconds: Option.none(), status: 503 }),
    then(delivery, failedAt({ attempt: 1, reason: "status 503", retryAt: "2026-01-01T00:00:05Z" })),
    clock("2026-01-01T00:00:04Z"),
    then(delivery),
    clock("2026-01-01T00:00:05Z"),
    then(delivery, AttemptStarted.make({ attempt: 2 })),
    posted,
    // The second backoff is five minutes and the receiver asks for ten, so ten wins.
    succeed(WebhookTransport.post, { retryAfterSeconds: Option.some(tenMinutes), status: 429 }),
    then(delivery, failedAt({ attempt: 2, reason: "status 429", retryAt: "2026-01-01T00:10:05Z" })),
    clock("2026-01-01T00:05:05Z"),
    then(delivery),
    clock("2026-01-01T00:10:05Z"),
    then(delivery, AttemptStarted.make({ attempt: 3 })),
    posted,
    succeed(WebhookTransport.post, { retryAfterSeconds: Option.none(), status: 204 }),
    then(delivery, Delivered.make({ attempt: 3 })),
    then(endpoints),
  );

// When each retry is due: 5 seconds, 5 minutes, 30 minutes, 2 hours, 5 hours, 10 hours and 10 hours after the last.
const retries = [
  { attempt: 1, retryAt: "2026-01-01T00:00:05Z" },
  { attempt: 2, retryAt: "2026-01-01T00:05:05Z" },
  { attempt: 3, retryAt: "2026-01-01T00:35:05Z" },
  { attempt: 4, retryAt: "2026-01-01T02:35:05Z" },
  { attempt: 5, retryAt: "2026-01-01T07:35:05Z" },
  { attempt: 6, retryAt: "2026-01-01T17:35:05Z" },
  { attempt: 7, retryAt: "2026-01-02T03:35:05Z" },
];

const timedOut = (retry: { readonly attempt: number; readonly retryAt: string }): readonly Step[] => [
  fail(WebhookTransport.post, TransportFailed.make({ reason: "timeout" })),
  then(delivery, failedAt({ ...retry, reason: "timeout" })),
  clock(retry.retryAt),
  then(delivery, AttemptStarted.make({ attempt: Num.increment(retry.attempt) })),
  posted,
];

const exhaustedAfterLimit = (): Effect.Effect<void, StoryFailure> =>
  outboundStory(
    ...published,
    ...Arr.flatMap(retries, timedOut),
    succeed(WebhookTransport.post, { retryAfterSeconds: Option.none(), status: 500 }),
    then(delivery, Exhausted.make({ attempts: 8, reason: "status 500" })),
    Story.state(delivery, { attempts: 8, outcome: "exhausted" }),
    then(endpoints, FailureCounted.make({ endpointId, failuresInRow: 1 })),
    Story.advance("7 days"),
    then(delivery),
  );

describe("a webhook delivery", () => {
  it.effect("is retried with backoff after a failure and succeeds on a later attempt", retriedUntilDelivered);
  it.effect("stops after the eighth attempt fails and is marked failed", exhaustedAfterLimit);
});
