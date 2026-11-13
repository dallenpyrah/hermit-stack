import { fromExporter } from "@repo/telemetry/exporter";
import type { Telemetry } from "@repo/telemetry/telemetry";
import { Config, Effect, Layer, Record as Rec, Redacted, Schema } from "effect";
import type { ConfigError } from "effect/Config";
import { FetchHttpClient } from "effect/http";
import { Otlp } from "effect/observability";

// The standard OpenTelemetry variables, so the values any OTLP backend documents work unchanged. Header values are
// URL-encoded per the OpenTelemetry spec and stay redacted until a request is sent, because they usually carry a token.
const OtlpConfig = Config.all({
  endpoint: Config.URL("OTEL_EXPORTER_OTLP_ENDPOINT"),
  headers: Config.Record(
    Schema.String,
    Schema.RedactedFromValue(Schema.StringFromUriComponent),
    "OTEL_EXPORTER_OTLP_HEADERS",
  ).pipe(Config.withDefault({})),
  serviceName: Config.String("OTEL_SERVICE_NAME"),
});

// Exports traces, logs and metrics as OTLP/HTTP JSON to OTEL_EXPORTER_OTLP_ENDPOINT. The endpoint is required: Effect's
// Own Otlp.layerFromConfig quietly exports nothing when it is missing, the silent no-op the Telemetry service exists to
// Rule out, so a missing value fails the Layer with a ConfigError instead.
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
