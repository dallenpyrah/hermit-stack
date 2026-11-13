import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { Array as Arr, Effect, Layer, Option, Record as Rec, Schema, pipe } from "effect";
import type { Scope } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { HttpServerError } from "effect/http";
import { NetAddress } from "effect/net";

import { withParentNames } from "#tests/telemetry.fake";
import type { AttributeValue, RecordedSpan } from "#tests/telemetry.fake";

// One POST the collector received, as it arrived on the wire.
interface CollectedRequest {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly path: string;
}

// A span the collector received, with the service.name of the resource it was exported under.
interface CollectedSpan extends RecordedSpan {
  readonly service: string | undefined;
}

interface OtlpCollector {
  readonly requests: Effect.Effect<readonly CollectedRequest[]>;
  readonly spans: Effect.Effect<readonly CollectedSpan[]>;
  // The base URL an exporter posts to, with /v1/traces, /v1/logs and /v1/metrics below it.
  readonly url: string;
}

const AnyValue = Schema.Struct({
  boolValue: Schema.optional(Schema.Boolean),
  doubleValue: Schema.optional(Schema.Finite),
  intValue: Schema.optional(Schema.Union([Schema.Finite, Schema.String])),
  stringValue: Schema.optional(Schema.String),
});

const KeyValue = Schema.Struct({ key: Schema.String, value: AnyValue });

const OtlpSpan = Schema.Struct({
  attributes: Schema.Array(KeyValue),
  name: Schema.String,
  parentSpanId: Schema.optional(Schema.String),
  spanId: Schema.String,
  status: Schema.Struct({ code: Schema.Finite }),
  traceId: Schema.String,
});

const ScopeSpans = Schema.Struct({ spans: Schema.Array(OtlpSpan) });

const Resource = Schema.Struct({ attributes: Schema.Array(KeyValue) });

const ResourceSpans = Schema.Struct({ resource: Resource, scopeSpans: Schema.Array(ScopeSpans) });

// The part of an OTLP/HTTP JSON trace export a test asserts on; Schema ignores the fields it does not name.
const TraceExport = Schema.fromJsonString(Schema.Struct({ resourceSpans: Schema.Array(ResourceSpans) }));

const tracesPath = "/v1/traces";

// OpenTelemetry's STATUS_CODE_ERROR.
const errorStatusCode = 2;

const valueOf = (value: typeof AnyValue.Type): Option.Option<AttributeValue> =>
  pipe(
    Option.fromNullishOr(value.stringValue),
    Option.orElse(() => Option.fromNullishOr(value.intValue)),
    Option.orElse(() => Option.fromNullishOr(value.doubleValue)),
    Option.orElse(() => Option.fromNullishOr(value.boolValue)),
  );

const attributeOf = ({ key, value }: typeof KeyValue.Type): Option.Option<readonly [string, AttributeValue]> =>
  Option.map(valueOf(value), (scalar) => [key, scalar] as const);

const attributesOf = (pairs: readonly (typeof KeyValue.Type)[]): Readonly<Record<string, AttributeValue>> =>
  Rec.fromEntries(Arr.getSomes(Arr.map(pairs, attributeOf)));

const serviceOf = (pairs: readonly (typeof KeyValue.Type)[]): string | undefined =>
  pipe(
    Arr.findFirst(pairs, ({ key }) => key === "service.name"),
    Option.flatMap(({ value }) => Option.fromNullishOr(value.stringValue)),
    Option.getOrUndefined,
  );

const statusOf = (code: number): RecordedSpan["status"] => {
  if (code === errorStatusCode) {
    return "error";
  }

  return "unset";
};

const decodeTraceExport = Schema.decodeUnknownEffect(TraceExport);

const spansOf = Effect.fnUntraced(function* spansOf(requests: readonly CollectedRequest[]) {
  const exports = yield* Effect.forEach(
    Arr.filter(requests, ({ path }) => path === tracesPath),
    ({ body }) => decodeTraceExport(body),
  );

  return withParentNames(
    Arr.flatMap(exports, ({ resourceSpans }) =>
      Arr.flatMap(resourceSpans, ({ resource, scopeSpans }) =>
        Arr.flatMap(scopeSpans, (scope) =>
          Arr.map(scope.spans, (span) => ({
            attributes: attributesOf(span.attributes),
            name: span.name,
            parentSpanId: span.parentSpanId,
            service: serviceOf(resource.attributes),
            spanId: span.spanId,
            status: statusOf(span.status.code),
            traceId: span.traceId,
          })),
        ),
      ),
    ),
  );
});

const keep = (
  requests: CollectedRequest[],
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  HttpServerError.HttpServerError,
  HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* keepRequest() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const body = yield* request.text;
    requests.push({ body, headers: { ...request.headers }, path: request.url });

    return HttpServerResponse.text("{}", { contentType: "application/json" });
  });

// The test server listens on every interface, so the exporter is pointed at loopback the way Effect's own test client
// Is.
const urlOf = (address: NetAddress.SocketAddress): Effect.Effect<string> => {
  if (NetAddress.isUnixPathAddress(address)) {
    return Effect.die("The OTLP collector listens on TCP, not on a Unix socket.");
  }

  const url = Effect.orDie(Effect.fromResult(NetAddress.toUrl(address)));

  return Effect.map(url, (served) => {
    served.hostname = NetAddress.formatIp(NetAddress.ipv4Loopback);

    return served.origin;
  });
};

const collect = Effect.gen(function* collect() {
  const requests: CollectedRequest[] = [];
  yield* HttpServer.serveEffect(keep(requests));
  const server = yield* HttpServer.HttpServer;
  const received = Effect.sync((): readonly CollectedRequest[] => [...requests]);

  const collector: OtlpCollector = {
    requests: received,
    spans: Effect.orDie(Effect.flatMap(received, spansOf)),
    url: yield* urlOf(server.address),
  };

  return collector;
});

// An OTLP/HTTP receiver on a free local port for the life of the scope, standing in for a real backend. It answers
// Every POST with 200 and keeps the request, so a test asserts on what an exporter sent over the wire. A port that
// Cannot be bound is a broken test machine, not a case a test handles, so it is a defect.
const otlpCollector: Effect.Effect<OtlpCollector, never, Scope.Scope> = Effect.gen(function* otlpCollector() {
  const server = yield* Effect.orDie(Layer.build(layerTest));

  return yield* Effect.provideContext(collect, server);
});

export { otlpCollector };

export type { CollectedRequest, CollectedSpan, OtlpCollector };
