import { fromExporter } from "@repo/telemetry/exporter";
import type { Telemetry } from "@repo/telemetry/telemetry";
import { Config, Effect, Layer, Record as Rec, Redacted, Schema } from "effect";
import type { ConfigError } from "effect/Config";
import { FetchHttpClient } from "effect/http";
import { Otlp } from "effect/observability";

const OtlpConfig = Config.all({
  endpoint: Config.URL("OTEL_EXPORTER_OTLP_ENDPOINT"),
  headers: Config.Record(
    Schema.String,
    Schema.RedactedFromValue(Schema.StringFromUriComponent),
    "OTEL_EXPORTER_OTLP_HEADERS",
  ).pipe(Config.withDefault({})),
  serviceName: Config.String("OTEL_SERVICE_NAME"),
});

const layerOtlp: Layer.Layer<Telemetry, ConfigError> = Layer.unwrap(
  Effect.map(OtlpConfig, ({ endpoint, headers, serviceName }) =>
    Otlp.layerJson({
      baseUrl: endpoint.href,
      headers: Rec.map(headers, Redacted.value),
      resource: { serviceName },
    }).pipe(fromExporter("otlp"), Layer.provide(FetchHttpClient.layer)),
  ),
);

export { layerOtlp };
