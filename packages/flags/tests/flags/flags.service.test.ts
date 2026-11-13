import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Option, Schema } from "effect";

import type { Rule } from "#src/evaluate/evaluate.pure.js";
import { Flag } from "#src/flag/flag.pure.js";
import { Flags } from "#src/flags/flags.service.js";
import { FlagStoreError } from "#src/store/flag-store.errors.js";
import { FlagStore } from "#src/store/flag-store.service.js";
import { FlagStoreFake } from "#tests/store/flag-store.fake";

// The default is true so that a read that ignored the store, or one that fell back by mistake, answers differently from
// A store holding false.
const InstantWithdrawals = Flag.release("ledger.instant-withdrawals", Schema.Boolean, {
  default: true,
  owner: "ledger",
  purpose: "Pay withdrawals out without the settlement delay.",
  removeBy: "2999-01-01",
});

const CheckoutMode = Flag.ops("checkout.mode", Schema.Literals(["classic", "express", "paused"]), {
  default: "classic",
  owner: "checkout",
  purpose: "Switch checkout to a degraded mode during an incident.",
  reviewBy: "2999-01-01",
});

const valueKey = "feature_flag.ledger.instant-withdrawals";
const fallbackKey = "feature_flag.fallback.ledger.instant-withdrawals";

interface Traced<Value> {
  readonly attributes: ReadonlyMap<string, unknown>;
  readonly value: Value;
}

// Reads the flag inside a span standing for the caller's request, and returns what that span carries afterwards.
const readInSpan = <Value>(
  flag: Flag<Value>,
  layer: Layer.Layer<Flags>,
  subject?: string,
): Effect.Effect<Traced<Value>, Error> =>
  Effect.gen(function* readInSpanGen() {
    const services = yield* Layer.build(layer);

    return yield* Effect.gen(function* inRequest() {
      const value = yield* Flags.get(flag, subject);
      const span = yield* Effect.currentSpan;

      return { attributes: span.attributes, value };
    }).pipe(Effect.withSpan("request"), Effect.provideContext(services));
  }).pipe(Effect.scoped);

const storing = (settings: Readonly<Record<string, readonly Rule<unknown>[]>>): Layer.Layer<Flags> =>
  Layer.provide(Flags.layer, FlagStoreFake(settings));

const failingStore = Layer.provide(
  Flags.layer,
  Layer.succeed(FlagStore, {
    rules: (flag) => Effect.fail(FlagStoreError.make({ cause: "connection refused", flag: flag.name })),
  }),
);

const fromConfig = (values: Readonly<Record<string, string>>): Layer.Layer<Flags> =>
  Layer.provide(Flags.layerConfig, ConfigProvider.layer(ConfigProvider.fromUnknown(values)));

const readsEachBooleanValue = Effect.fn("readsEachBooleanValue")(function* readsEachBooleanValue() {
  const off = yield* readInSpan(InstantWithdrawals, storing({ "ledger.instant-withdrawals": [{ value: false }] }));
  const unset = yield* readInSpan(InstantWithdrawals, storing({}));

  expect(off.value).toBe(false);
  expect(unset.value).toBe(true);
});

const readsEachLiteralValue = Effect.fn("readsEachLiteralValue")(function* readsEachLiteralValue() {
  const express = yield* readInSpan(CheckoutMode, storing({ "checkout.mode": [{ value: "express" }] }));
  const paused = yield* readInSpan(CheckoutMode, storing({ "checkout.mode": [{ value: "paused" }] }));
  const classic = yield* readInSpan(CheckoutMode, storing({}));

  expect([express.value, paused.value, classic.value]).toStrictEqual(["express", "paused", "classic"]);
});

const failingStoreFallsBack = Effect.fn("failingStoreFallsBack")(function* failingStoreFallsBack() {
  const read = yield* readInSpan(InstantWithdrawals, failingStore);

  expect(read.value).toBe(true);
  expect(read.attributes.get(fallbackKey)).toBe("store-failed");
  expect(read.attributes.get(valueKey)).toBe(true);
});

const rejectedValueFallsBack = Effect.fn("rejectedValueFallsBack")(function* rejectedValueFallsBack() {
  const read = yield* readInSpan(InstantWithdrawals, storing({ "ledger.instant-withdrawals": [{ value: "no" }] }));

  expect(read.value).toBe(true);
  expect(read.attributes.get(fallbackKey)).toBe("invalid-value");
});

const healthyReadRecordsNoFallback = Effect.fn("healthyReadRecordsNoFallback")(function* healthyRead() {
  const read = yield* readInSpan(InstantWithdrawals, storing({ "ledger.instant-withdrawals": [{ value: false }] }));

  expect(read.attributes.get(valueKey)).toBe(false);
  expect(Option.fromUndefinedOr(read.attributes.get(fallbackKey))).toStrictEqual(Option.none());
});

const rollsOutBySubject = Effect.fn("rollsOutBySubject")(function* rollsOutBySubject() {
  const layer = storing({ "checkout.mode": [{ subjects: ["user-7"], value: "express" }] });
  const listed = yield* readInSpan(CheckoutMode, layer, "user-7");
  const other = yield* readInSpan(CheckoutMode, layer, "user-8");

  expect([listed.value, other.value]).toStrictEqual(["express", "classic"]);
});

const readsConfig = Effect.fn("readsConfig")(function* readsConfig() {
  const mode = yield* readInSpan(CheckoutMode, fromConfig({ FLAG_CHECKOUT_MODE: "paused" }));
  const instant = yield* readInSpan(InstantWithdrawals, fromConfig({ FLAG_LEDGER_INSTANT_WITHDRAWALS: "false" }));
  const unset = yield* readInSpan(CheckoutMode, fromConfig({}));

  expect([mode.value, instant.value, unset.value]).toStrictEqual(["paused", false, "classic"]);
});

const rejectedConfigFallsBack = Effect.fn("rejectedConfigFallsBack")(function* rejectedConfigFallsBack() {
  const read = yield* readInSpan(InstantWithdrawals, fromConfig({ FLAG_LEDGER_INSTANT_WITHDRAWALS: "sometimes" }));

  expect(read.value).toBe(true);
  expect(read.attributes.get(fallbackKey)).toBe("store-failed");
});

describe("reading a flag", () => {
  it.effect("returns each value a boolean flag can hold", readsEachBooleanValue);
  it.effect("returns each value a literal flag can hold", readsEachLiteralValue);
  it.effect("answers with the default and records the fallback when the store fails", failingStoreFallsBack);
  it.effect(
    "answers with the default and records the fallback when the Schema rejects the value",
    rejectedValueFallsBack,
  );
  it.effect("puts the flag's name and value on the caller's span", healthyReadRecordsNoFallback);
  it.effect("evaluates the stored rules for the subject", rollsOutBySubject);
  it.effect("reads one value per flag from Effect Config", readsConfig);
  it.effect("answers with the default when Config holds a value the Schema rejects", rejectedConfigFallsBack);
});
