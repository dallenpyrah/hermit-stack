import { describe, expect, it } from "@effect/vitest";
import { Effect, pipe } from "effect";

import { spanName } from "#src/telemetry/span-name.pure.js";

const joinsWithDot = (): void => {
  expect(spanName("ledger", "deposit")).toBe("ledger.deposit");
};

const writesKebabCase = (): void => {
  expect(spanName("ledger", "OpenAccount")).toBe("ledger.open-account");
};

const keepsKebabCase = (): void => {
  expect(spanName("outbound", "deliver-webhook")).toBe("outbound.deliver-webhook");
};

const takesContextFromPipe = (): void => {
  expect(pipe("ledger", spanName("CloseAccount"))).toBe("ledger.close-account");
};

describe("a span name", () => {
  it.effect("joins the context and the operation with a dot", () => Effect.sync(joinsWithDot));
  it.effect("writes a PascalCase operation in kebab case", () => Effect.sync(writesKebabCase));
  it.effect("leaves a kebab-case operation as it is", () => Effect.sync(keepsKebabCase));
  it.effect("takes the context from a pipe and the operation as its argument", () => Effect.sync(takesContextFromPipe));
});
