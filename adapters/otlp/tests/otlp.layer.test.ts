import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { spanName } from "@repo/kernel/span-name";
import { otlpCollector } from "@repo/telemetry/otlp-collector";
import { captureSpans, layerRecording } from "@repo/telemetry/recording";
import type { RecordedSpan } from "@repo/telemetry/recording";
import { Telemetry } from "@repo/telemetry/telemetry";
import { Array as Arr, ConfigProvider, Effect, Exit, Layer, Order, Predicate, pipe } from "effect";
import type { ConfigError } from "effect/Config";

import { layerOtlp } from "#src/otlp.layer.js";

const depositAmount = 25;

const deposit = Effect.fn("ledger.deposit")(function* deposit(amount: number) {
  yield* Effect.annotateCurrentSpan("ledger.amount", amount);
});

const openAccount = Effect.gen(function* openAccount() {
  const { backend } = yield* Telemetry;
  yield* Effect.annotateCurrentSpan("telemetry.backend", backend);
  yield* deposit(depositAmount);
}).pipe(Effect.withSpan(spanName("ledger", "OpenAccount"), { attributes: { "ledger.account": "acc-1" } }));

const expectedSpans = (backend: string): readonly Partial<RecordedSpan>[] => [
  { attributes: { "ledger.amount": depositAmount }, name: "ledger.deposit", parent: "ledger.open-account" },
  { attributes: { "ledger.account": "acc-1", "telemetry.backend": backend }, name: "ledger.open-account" },
];

const rootNames = (spans: readonly RecordedSpan[]): readonly string[] =>
  pipe(
    spans,
    Arr.filter(({ parent }) => Predicate.isUndefined(parent)),
    Arr.map(({ name }) => name),
  );

const environment = (env: Record<string, string>): Layer.Layer<never> =>
  ConfigProvider.layer(ConfigProvider.fromEnv({ env }));

const otlpWith = (env: Record<string, string>): Layer.Layer<Telemetry, ConfigError> =>
  layerOtlp.pipe(Layer.provide(environment(env)));

const runSample = <Failure>(telemetry: Layer.Layer<Telemetry, Failure>): Effect.Effect<void, Failure> =>
  Effect.scoped(
    Effect.gen(function* buildAndRun() {
      const context = yield* Layer.build(telemetry);

      yield* Effect.provideContext(openAccount, context);
    }),
  );

const byName = Order.mapInput(Order.String, (span: RecordedSpan) => span.name);

const recordsTheSampleInMemory = Effect.fn("recordsTheSampleInMemory")(function* recordsTheSampleInMemory() {
  const { exit, spans } = yield* layerRecording.pipe(runSample, captureSpans);

  expect(Exit.isSuccess(exit)).toBe(true);
  expect(Arr.sort(spans, byName)).toMatchObject(expectedSpans("recording"));
  expect(rootNames(spans)).toStrictEqual(["ledger.open-account"]);
});

const exportsTheSampleOverTheWire = Effect.fn("exportsTheSampleOverTheWire")(function* exportsTheSampleOverTheWire() {
  const collector = yield* otlpCollector;

  yield* runSample(
    otlpWith({
      OTEL_EXPORTER_OTLP_ENDPOINT: collector.url,
      OTEL_EXPORTER_OTLP_HEADERS: "authorization=Bearer%20otlp-test-token",
      OTEL_SERVICE_NAME: "ledger-api",
    }),
  );
  const spans = yield* collector.spans;
  const requests = yield* collector.requests;

  expect(Arr.sort(spans, byName)).toMatchObject(expectedSpans("otlp"));
  expect(rootNames(spans)).toStrictEqual(["ledger.open-account"]);
  expect(Arr.every(spans, ({ service }) => service === "ledger-api")).toBe(true);
  expect(Arr.findFirst(requests, ({ path }) => path === "/v1/traces")).toMatchObject({
    value: { headers: { authorization: "Bearer otlp-test-token" } },
  });
});

const failsWithoutAnEndpoint = Effect.fn("failsWithoutAnEndpoint")(function* failsWithoutAnEndpoint() {
  const exit = yield* Effect.exit(runSample(otlpWith({ OTEL_SERVICE_NAME: "ledger-api" })));

  expect(Exit.isFailure(exit)).toBe(true);
});

const needsATelemetryLayer = (): void => {
  const target = Layer.effectDiscard(openAccount);

  expectTypeOf<Layer.Services<typeof target>>().toEqualTypeOf<Telemetry>();
  expectTypeOf(target).not.toExtend<Layer.Layer<never, unknown>>();
  expectTypeOf(Layer.provide(target, layerRecording)).toExtend<Layer.Layer<never>>();
  expectTypeOf(Layer.provide(target, layerOtlp)).toExtend<Layer.Layer<never, ConfigError>>();
};

describe("one sample program on two backends", () => {
  it.effect("records its spans in memory with the recording Layer", () => recordsTheSampleInMemory());
  it.effect("sends the same spans to an OTLP/HTTP server with the OTLP Layer", () => exportsTheSampleOverTheWire());
  it.effect("fails to build the OTLP Layer when no endpoint is configured", () => failsWithoutAnEndpoint());
  it.effect("does not typecheck as a runnable program until a telemetry Layer is provided", () =>
    Effect.sync(needsATelemetryLayer),
  );
});
