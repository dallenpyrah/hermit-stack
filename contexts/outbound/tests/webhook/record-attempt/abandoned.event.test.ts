import { Story } from "@alchemy.run/domain/Story";
import type { StoryFailure } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import { Option } from "effect";
import type { Effect } from "effect";

import { Abandoned } from "#src/webhook/record-attempt/abandoned.event.js";
import { EndpointDisabled } from "#src/webhook/record-outcome/endpoint-disabled.event.js";
import { WebhookTransport } from "#src/webhook/webhook-transport.external.js";
import { outboundStory } from "#tests/outbound.suite";
import { attempt, delivery, endpointId, endpoints, published, publishedAgain } from "#tests/webhook/delivery.suite";

const { call, succeed, then } = Story;

const abandonedOnGone = (): Effect.Effect<void, StoryFailure> =>
  outboundStory(
    ...published,
    call(WebhookTransport.post, attempt),
    succeed(WebhookTransport.post, { retryAfterSeconds: Option.none(), status: 410 }),
    then(delivery, Abandoned.make({ attempt: 1 })),
    Story.state(delivery, { attempts: 1, outcome: "gone" }),
    then(endpoints, EndpointDisabled.make({ endpointId, reason: "gone" })),
    Story.advance("7 days"),
    then(delivery),
    ...publishedAgain,
  );

describe("a webhook delivery the receiver answers with 410 Gone", () => {
  it.effect("is abandoned without a retry, and its endpoint gets no later events", abandonedOnGone);
});
