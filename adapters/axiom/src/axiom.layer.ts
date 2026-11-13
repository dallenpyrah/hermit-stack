import { fromExporter } from "@repo/telemetry/exporter";
import type { Telemetry } from "@repo/telemetry/telemetry";
import { Config, Effect, Layer, Option, Redacted } from "effect";
import type { ConfigError } from "effect/Config";
import { FetchHttpClient, Headers } from "effect/http";
import { OtlpLogger, OtlpSerialization, OtlpTracer } from "effect/observability";

// AXIOM_URL is the origin of the edge deployment that stores the datasets, such as
// Https://us-east-1.aws.edge.axiom.co; an Alchemy Axiom.Dataset exposes it as otelEndpoint. Any path on it is dropped. Traces go to AXIOM_DATASET,
// And logs go to AXIOM_LOGS_DATASET only when it is set, because Axiom keeps each OpenTelemetry signal in a dataset of
// Its own kind.
const AxiomConfig = Config.all({
  dataset: Config.String("AXIOM_DATASET"),
  logsDataset: Config.option(Config.String("AXIOM_LOGS_DATASET")),
  serviceName: Config.String("OTEL_SERVICE_NAME"),
  token: Config.Redacted("AXIOM_TOKEN"),
  url: Config.URL("AXIOM_URL"),
});

type AxiomSettings = typeof AxiomConfig extends Config.Config<infer Settings> ? Settings : never;

// Axiom routes an OTLP export to a dataset by its X-Axiom-Dataset header, and authorizes it with an ingest token.
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

// Exports traces, and logs when a logs dataset is configured, to Axiom over OTLP/HTTP JSON. Every setting but the logs
// Dataset is required, so a missing one fails the Layer with a ConfigError instead of exporting nothing.
const layerAxiom: Layer.Layer<Telemetry, ConfigError> = Layer.unwrap(Effect.map(AxiomConfig, exporterFor));

export { layerAxiom };
