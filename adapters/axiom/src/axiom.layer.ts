import { fromExporter } from "@repo/telemetry/exporter";
import type { Telemetry } from "@repo/telemetry/telemetry";
import { Config, Effect, Layer, Option, Redacted } from "effect";
import type { ConfigError } from "effect/Config";
import { FetchHttpClient, Headers } from "effect/http";
import { OtlpLogger, OtlpSerialization, OtlpTracer } from "effect/observability";

const AxiomConfig = Config.all({
  dataset: Config.String("AXIOM_DATASET"),
  logsDataset: Config.option(Config.String("AXIOM_LOGS_DATASET")),
  serviceName: Config.String("OTEL_SERVICE_NAME"),
  token: Config.Redacted("AXIOM_TOKEN"),
  url: Config.URL("AXIOM_URL"),
});

type AxiomSettings = typeof AxiomConfig extends Config.Config<infer Settings> ? Settings : never;

const headersFor = (token: Redacted.Redacted, dataset: string): Headers.Headers =>
  Headers.fromInput({ Authorization: `Bearer ${Redacted.value(token)}`, "X-Axiom-Dataset": dataset });

const exporterFor = ({ dataset, logsDataset, serviceName, token, url }: AxiomSettings): Layer.Layer<Telemetry> => {
  const resource = { serviceName };

  const traces = OtlpTracer.layer({
    headers: headersFor(token, dataset),
    resource,
    url: `${url.origin}/v1/traces`,
  });

  const logs = Option.match(logsDataset, {
    onNone: () => Layer.empty,
    onSome: (logged) =>
      OtlpLogger.layer({ headers: headersFor(token, logged), resource, url: `${url.origin}/v1/logs` }),
  });

  return Layer.mergeAll(traces, logs).pipe(
    Layer.provide(OtlpSerialization.layerJson),
    fromExporter("axiom"),
    Layer.provide(FetchHttpClient.layer),
  );
};

const layerAxiom: Layer.Layer<Telemetry, ConfigError> = Layer.unwrap(Effect.map(AxiomConfig, exporterFor));

export { layerAxiom };
