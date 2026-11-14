import { verify } from "@alchemy.run/domain";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { Billing } from "#src/billing.model.js";

const isWellDefined = (): void => {
  expect(verify(Billing)).toStrictEqual([]);
};

describe("the billing model", () => {
  it.effect("has no definition problems", () => Effect.sync(isWellDefined));
});
