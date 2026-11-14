import { Story } from "@alchemy.run/domain/Story";
import type { StoryFailure } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import { DateTime, Option } from "effect";
import type { Effect } from "effect";

import { AttemptStarted } from "#src/webhook/attempt-delivery/attempt-started.event.js";
import { AttemptFailed } from "#src/webhook/record-attempt/attempt-failed.event.js";
import { Delivered } from "#src/webhook/record-attempt/delivered.event.js";
import { WebhookTransport } from "#src/webhook/webhook-transport.external.js";
import { outboundStory } from "#tests/outbound.suite";
import { attempt, delivery, endpoints, published } from "#tests/webhook/delivery.suite";

const { call, clock, succeed, then } = Story;

const posted = call(WebhookTransport.post, attempt);

const tenMinutes = 600;

const unavailable = AttemptFailed.make({
  attempt: 1,
  reason: "status 503",
  retryAt: DateTime.makeUnsafe("2026-01-01T00:00:05Z"),
});

const rateLimited = AttemptFailed.make({
  attempt: 2,
  reason: "status 429",
  retryAt: DateTime.makeUnsafe("2026-01-01T00:10:05Z"),
});

const retriedUntilDelivered = (): Effect.Effect<void, StoryFailure> =>
  outboundStory(
    ...published,
    posted,
    succeed(WebhookTransport.post, { retryAfterSeconds: Option.none(), status: 503 }),
    then(delivery, unavailable),
    clock("2026-01-01T00:00:04Z"),
    then(delivery),
    clock("2026-01-01T00:00:05Z"),
    then(delivery, AttemptStarted.make({ attempt: 2 })),
    posted,
    succeed(WebhookTransport.post, { retryAfterSeconds: Option.some(tenMinutes), status: 429 }),
    then(delivery, rateLimited),
    clock("2026-01-01T00:05:05Z"),
    then(delivery),
    clock("2026-01-01T00:10:05Z"),
    then(delivery, AttemptStarted.make({ attempt: 3 })),
    posted,
    succeed(WebhookTransport.post, { retryAfterSeconds: Option.none(), status: 204 }),
    then(delivery, Delivered.make({ attempt: 3 })),
    then(endpoints),
  );

describe("a webhook delivery whose attempt fails", () => {
  it.effect("is retried with backoff after a failure and succeeds on a later attempt", retriedUntilDelivered);
});
