import { Story } from "@alchemy.run/domain/Story";
import type { Step, StoryFailure } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import { Array as Arr, DateTime, Number as Num, Option } from "effect";
import type { Effect } from "effect";

import { AttemptStarted } from "#src/webhook/attempt-delivery/attempt-started.event.js";
import { AttemptFailed } from "#src/webhook/record-attempt/attempt-failed.event.js";
import { Exhausted } from "#src/webhook/record-attempt/exhausted.event.js";
import { FailureCounted } from "#src/webhook/record-outcome/failure-counted.event.js";
import { TransportFailed, WebhookTransport } from "#src/webhook/webhook-transport.external.js";
import { outboundStory } from "#tests/outbound.suite";
import { attempt, delivery, endpointId, endpoints, published } from "#tests/webhook/delivery.suite";

const { call, clock, fail, succeed, then } = Story;

const posted = call(WebhookTransport.post, attempt);

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
  then(
    delivery,
    AttemptFailed.make({ attempt: retry.attempt, reason: "timeout", retryAt: DateTime.makeUnsafe(retry.retryAt) }),
  ),
  clock(retry.retryAt),
  then(delivery, AttemptStarted.make({ attempt: Num.increment(retry.attempt) })),
  posted,
];

const exhaustedAfterLimit = (): Effect.Effect<void, StoryFailure> =>
  outboundStory(
    ...published,
    posted,
    ...Arr.flatMap(retries, timedOut),
    succeed(WebhookTransport.post, { retryAfterSeconds: Option.none(), status: 500 }),
    then(delivery, Exhausted.make({ attempts: 8, reason: "status 500" })),
    Story.state(delivery, { attempts: 8, outcome: "exhausted" }),
    then(endpoints, FailureCounted.make({ endpointId, failuresInRow: 1 })),
    Story.advance("7 days"),
    then(delivery),
  );

describe("a webhook delivery that fails every attempt", () => {
  it.effect("stops after the eighth attempt fails and is marked failed", exhaustedAfterLimit);
});
