import {
  Array as Arr,
  Cause,
  Effect,
  Exit,
  Formatter,
  Layer,
  Option,
  Predicate,
  Record as Rec,
  Schema,
  Tracer,
  pipe,
} from "effect";

import { Telemetry } from "#src/telemetry.service.js";

// The scalar values an OTLP attribute carries; anything else is recorded as its formatted text.
type AttributeValue = string | number | boolean;

// One ended span in the shape a test asserts on, whether it was recorded in memory or received by an OTLP collector.
interface RecordedSpan {
  readonly attributes: Readonly<Record<string, AttributeValue>>;
  readonly name: string;
  // The parent span's name when the parent is among the same spans; undefined for the root of the operation.
  readonly parent: string | undefined;
  readonly parentSpanId: string | undefined;
  readonly spanId: string;
  // The OpenTelemetry status code, set the way Effect's OTLP exporter sets it: error when the span's effect failed,
  // Unset otherwise, interruption included.
  readonly status: "error" | "unset";
  readonly traceId: string;
}

interface CapturedOperation<Value, Failure> {
  readonly exit: Exit.Exit<Value, Failure>;
  readonly spans: readonly RecordedSpan[];
}

type EndedStatus = Extract<Tracer.SpanStatus, { readonly _tag: "Ended" }>;

interface EndedSpan {
  readonly span: Tracer.NativeSpan;
  readonly status: EndedStatus;
}

const ScalarAttribute = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]);

const decodeScalar = Schema.decodeUnknownOption(ScalarAttribute);

const isEnded = Predicate.isTagged("Ended");

const endedSpan = (span: Tracer.NativeSpan): Option.Option<EndedSpan> => {
  const { status } = span;

  if (isEnded(status)) {
    return Option.some({ span, status });
  }

  return Option.none();
};

const statusOf = ({ exit }: EndedStatus): RecordedSpan["status"] => {
  if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)) {
    return "error";
  }

  return "unset";
};

const parentSpanIdOf = (span: Tracer.NativeSpan): string | undefined =>
  pipe(
    span.parent,
    Option.map((parent) => parent.spanId),
    Option.getOrUndefined,
  );

const attributesOf = (span: Tracer.NativeSpan): Readonly<Record<string, AttributeValue>> =>
  Rec.map(Rec.fromEntries(span.attributes), (value) =>
    Option.getOrElse(decodeScalar(value), () => Formatter.format(value)),
  );

// Parents are named after every span has ended, because a child always ends before its parent.
const withParentNames = <Span extends Omit<RecordedSpan, "parent">>(
  spans: readonly Span[],
): readonly (Span & Pick<RecordedSpan, "parent">)[] => {
  const names = new Map(Arr.map(spans, (span) => [span.spanId, span.name] as const));

  return Arr.map(spans, (span) => ({
    ...span,
    parent: pipe(
      Option.fromNullishOr(span.parentSpanId),
      Option.flatMap((id) => Option.fromNullishOr(names.get(id))),
      Option.getOrUndefined,
    ),
  }));
};

const recordedSpans = (started: readonly Tracer.NativeSpan[]): readonly RecordedSpan[] => {
  const ended = Arr.getSomes(Arr.map(started, endedSpan));

  return withParentNames(
    Arr.map(ended, ({ span, status }) => ({
      attributes: attributesOf(span),
      name: span.name,
      parentSpanId: parentSpanIdOf(span),
      spanId: span.spanId,
      status: statusOf(status),
      traceId: span.traceId,
    })),
  );
};

// Provides Telemetry to a test without exporting anything, so a host that requires it runs in memory.
const layerRecording: Layer.Layer<Telemetry> = Layer.succeed(
  Telemetry,
  Telemetry.of({ backend: "recording", flush: Effect.void }),
);

// Runs one operation under its own tracer and returns how it ended with every span that ended inside it, in the order
// They started. A tracer per call keeps concurrent operations from seeing each other's spans.
const captureSpans = <Value, Failure, Services>(
  operation: Effect.Effect<Value, Failure, Services>,
): Effect.Effect<CapturedOperation<Value, Failure>, never, Services> =>
  Effect.suspend(() => {
    const started: Tracer.NativeSpan[] = [];

    const tracer = Tracer.make({
      span: (options): Tracer.NativeSpan => {
        const span = new Tracer.NativeSpan(options);
        started.push(span);

        return span;
      },
    });

    return pipe(
      operation,
      Effect.withTracer(tracer),
      Effect.exit,
      Effect.map((exit) => ({ exit, spans: recordedSpans(started) })),
    );
  });

export { captureSpans, layerRecording, withParentNames };

export type { AttributeValue, CapturedOperation, RecordedSpan };
