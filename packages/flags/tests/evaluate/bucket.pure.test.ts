import { describe, expect, it } from "@effect/vitest";
import { Effect, pipe } from "effect";

import { bucket } from "#src/evaluate/bucket.pure.js";

const pinned = [
  { expected: 50.542037515, flagName: "ledger.instant-withdrawals", subject: "user-1" },
  { expected: 68.97034843, flagName: "ledger.instant-withdrawals", subject: "user-2" },
  { expected: 75.344841555, flagName: "checkout.new-flow", subject: "acct-42" },
  { expected: 89.779419568, flagName: "checkout.new-flow", subject: "zoë-🦊" },
];

const decimalPlaces = 8;

const pinsKnownBuckets = (): void => {
  for (const { expected, flagName, subject } of pinned) {
    expect(bucket(flagName, subject)).toBeCloseTo(expected, decimalPlaces);
  }
};

const takesFlagFromPipe = (): void => {
  expect(pipe("ledger.instant-withdrawals", bucket("user-1"))).toBe(bucket("ledger.instant-withdrawals", "user-1"));
};

describe("a rollout bucket", () => {
  it.effect("matches buckets an independent implementation computed, astral code points included", () =>
    Effect.sync(pinsKnownBuckets),
  );
  it.effect("takes the flag name from a pipe and the subject as its argument", () => Effect.sync(takesFlagFromPipe));
});
