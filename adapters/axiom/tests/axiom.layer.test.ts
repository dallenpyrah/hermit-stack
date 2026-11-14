import { describe, expect, it } from "@effect/vitest";
import { otlpCollector } from "@repo/telemetry/otlp-collector";
import { Telemetry } from "@repo/telemetry/telemetry";
import { Array as Arr, ConfigProvider, Effect, Exit, Layer } from "effect";
import type { ConfigError } from "effect/Config";

import { layerAxiom } from "#src/axiom.layer.js";

const signIn = Effect.gen(function* signIn() {
  const { backend } = yield* Telemetry;
  yield* Effect.logInfo("signed in");
  yield* Effect.annotateCurrentSpan("telemetry.backend", backend);
}).pipe(Effect.withSpan("auth.sign-in"));

const environment = (env: Record<string, string>): Layer.Layer<never> =>
  ConfigProvider.layer(ConfigProvider.fromEnv({ env }));

const axiomWith = (env: Record<string, string>): Layer.Layer<Telemetry, ConfigError> =>
  layerAxiom.pipe(Layer.provide(environment(env)));

const runWith = (env: Record<string, string>): Effect.Effect<void, ConfigError> =>
  Effect.scoped(
    Effect.gen(function* buildAndRun() {
      const context = yield* Layer.build(axiomWith(env));

      yield* Effect.provideContext(signIn, context);
    }),
  );

const sendsEachSignalToItsDataset = Effect.fn("sendsEachSignalToItsDataset")(function* sendsEachSignalToItsDataset() {
  const collector = yield* otlpCollector;

  yield* runWith({
    AXIOM_DATASET: "auth-traces",
    AXIOM_LOGS_DATASET: "auth-logs",
    AXIOM_TOKEN: "xaat-test-token",
    AXIOM_URL: collector.url,
    OTEL_SERVICE_NAME: "auth-api",
  });
  const requests = yield* collector.requests;
  const spans = yield* collector.spans;

  expect(Arr.findFirst(requests, ({ path }) => path === "/v1/traces")).toMatchObject({
    value: { headers: { authorization: "Bearer xaat-test-token", "x-axiom-dataset": "auth-traces" } },
  });
  expect(Arr.findFirst(requests, ({ path }) => path === "/v1/logs")).toMatchObject({
    value: { headers: { authorization: "Bearer xaat-test-token", "x-axiom-dataset": "auth-logs" } },
  });
  expect(spans).toMatchObject([
    { attributes: { "telemetry.backend": "axiom" }, name: "auth.sign-in", service: "auth-api" },
  ]);
});

const failsWithoutAToken = Effect.fn("failsWithoutAToken")(function* failsWithoutAToken() {
  const exit = yield* Effect.exit(
    runWith({
      AXIOM_DATASET: "auth-traces",
      AXIOM_URL: "https://us-east-1.aws.edge.axiom.co",
      OTEL_SERVICE_NAME: "auth-api",
    }),
  );

  expect(Exit.isFailure(exit)).toBe(true);
});

describe("telemetry exported to Axiom", () => {
  it.effect("sends traces and logs to their datasets with the ingest token", () => sendsEachSignalToItsDataset());
  it.effect("fails to build without an ingest token", () => failsWithoutAToken());
});
