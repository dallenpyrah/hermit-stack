import { Story } from "@alchemy.run/domain/Story";
import type { Step } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import { DateTime } from "effect";

import { AttemptStarted } from "#src/webhook/attempt-delivery/attempt-started.event.js";
import { AttemptFailed } from "#src/webhook/record-attempt/attempt-failed.event.js";
import { Delivered } from "#src/webhook/record-attempt/delivered.event.js";
import { RecordAttempt } from "#src/webhook/record-attempt/record-attempt.command.js";
import { outboundStory } from "#tests/outbound.suite";
import { delivery, published } from "#tests/webhook/delivery.suite";
import {
  answeredNoContent,
  noContent,
  postedToEndpoint,
  unavailable,
} from "#tests/webhook/record-attempt/transport-answer.suite";

const { clock, then, when } = Story;

type Case = () => ReturnType<typeof outboundStory>;

const firstFailed = AttemptFailed.make({
  attempt: 1,
  reason: "status 503",
  retryAt: DateTime.makeUnsafe("2026-01-01T00:00:05Z"),
});

const secondFailed = AttemptFailed.make({
  attempt: 2,
  reason: "status 503",
  retryAt: DateTime.makeUnsafe("2026-01-01T00:05:05Z"),
});

const secondAttemptAnswered = (second: typeof unavailable): readonly Step[] => [
  ...published,
  ...postedToEndpoint,
  when(delivery, RecordAttempt.make({ attempt: 1, outcome: unavailable })),
  then(delivery, firstFailed),
  clock("2026-01-01T00:00:05Z"),
  then(delivery, AttemptStarted.make({ attempt: 2 })),
  when(delivery, RecordAttempt.make({ attempt: 2, outcome: second })),
];

const latePostToWaiting: Case = () =>
  outboundStory(
    ...secondAttemptAnswered(unavailable),
    then(delivery, secondFailed),
    ...answeredNoContent,
    then(delivery),
  );

const latePostToSettled: Case = () =>
  outboundStory(
    ...secondAttemptAnswered(noContent),
    then(delivery, Delivered.make({ attempt: 2 })),
    ...answeredNoContent,
    then(delivery),
  );

describe("posting a webhook delivery", () => {
  it.effect("posts nothing when it runs late and finds the delivery waiting for a retry", latePostToWaiting);
  it.effect("posts nothing when it runs late and finds the delivery settled", latePostToSettled);
});
