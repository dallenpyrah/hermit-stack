import { Effect, Function as Fn, Layer } from "effect";
import { OtlpExporter } from "effect/observability";

import { Telemetry } from "#src/telemetry.service.js";

const fromExporterArity = 2;

const telemetryOf = (backend: string): Layer.Layer<Telemetry, never, OtlpExporter.Flusher> =>
  Layer.effect(
    Telemetry,
    Effect.map(Effect.service(OtlpExporter.Flusher), ({ flush }) => Telemetry.of({ backend, flush })),
  );

/** @stability unstable */
const fromExporter: {
  (
    backend: string,
  ): <Failure, Services>(
    exporter: Layer.Layer<OtlpExporter.Flusher, Failure, Services>,
  ) => Layer.Layer<Telemetry, Failure, Services>;
  <Failure, Services>(
    exporter: Layer.Layer<OtlpExporter.Flusher, Failure, Services>,
    backend: string,
  ): Layer.Layer<Telemetry, Failure, Services>;
} = Fn.dual(
  fromExporterArity,
  <Failure, Services>(
    exporter: Layer.Layer<OtlpExporter.Flusher, Failure, Services>,
    backend: string,
  ): Layer.Layer<Telemetry, Failure, Services> => Layer.provideMerge(telemetryOf(backend), exporter),
);

export { fromExporter };
