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

type AttributeValue = string | number | boolean;

interface RecordedSpan {
  readonly attributes: Readonly<Record<string, AttributeValue>>;
  readonly name: string;
  readonly parent: string | undefined;
  readonly parentSpanId: string | undefined;
  readonly spanId: string;
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

const layerRecording: Layer.Layer<Telemetry> = Layer.succeed(
  Telemetry,
  Telemetry.of({ backend: "recording", flush: Effect.void }),
);

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
