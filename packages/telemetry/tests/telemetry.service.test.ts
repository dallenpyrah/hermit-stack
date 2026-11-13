import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Exit, Option, Schema } from "effect";

import { captureSpans } from "#tests/telemetry.fake";

class TransferRejectedError extends Schema.TaggedError<TransferRejectedError, { readonly brand: unique symbol }>()(
  "TransferRejectedError",
  {},
) {}

const transfer = Effect.void.pipe(
  Effect.withSpan("ledger.debit", { attributes: { "ledger.amount": 40 } }),
  Effect.andThen(Effect.withSpan(Effect.void, "ledger.credit")),
  Effect.withSpan("ledger.transfer", { attributes: { "ledger.from": "acc-1" } }),
);

const recordsNamesAttributesAndParents = Effect.fn("recordsNamesAttributesAndParents")(
  function* recordsNamesAttributesAndParents() {
    yield* Effect.withSpan(Effect.void, "before-capture");
    const { exit, spans } = yield* captureSpans(transfer);
    const [root, debit] = spans;

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(spans).toMatchObject([
      { attributes: { "ledger.from": "acc-1" }, name: "ledger.transfer", status: "unset" },
      { attributes: { "ledger.amount": 40 }, name: "ledger.debit", parent: "ledger.transfer", status: "unset" },
      { name: "ledger.credit", parent: "ledger.transfer", status: "unset" },
    ]);
    expect(root?.parent).toBeUndefined();
    expect(debit?.parentSpanId).toBe(root?.spanId);
    expect(Arr.every(spans, ({ traceId }) => traceId === root?.traceId)).toBe(true);
  },
);

const marksFailedSpansAsErrors = Effect.fn("marksFailedSpansAsErrors")(function* marksFailedSpansAsErrors() {
  const rejected = TransferRejectedError.make({});

  const { exit, spans } = yield* captureSpans(
    Effect.fail(rejected).pipe(Effect.withSpan("ledger.debit"), Effect.withSpan("ledger.transfer")),
  );

  expect(Exit.findErrorOption(exit)).toStrictEqual(Option.some(rejected));
  expect(spans).toMatchObject([
    { name: "ledger.transfer", status: "error" },
    { name: "ledger.debit", parent: "ledger.transfer", status: "error" },
  ]);
});

describe("capturing the spans of one operation", () => {
  it.effect("records each span's name, attributes and parent, and nothing that ended outside it", () =>
    recordsNamesAttributesAndParents(),
  );
  it.effect("returns the failure and marks the spans it passed through as errors", () => marksFailedSpansAsErrors());
});
