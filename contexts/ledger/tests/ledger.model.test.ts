import { verify } from "@alchemy.run/domain";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { Ledger } from "#src/ledger.model.js";

const isWellDefined = (): void => {
  expect(verify(Ledger)).toStrictEqual([]);
};

describe("the ledger model", () => {
  it.effect("has no definition problems", () => Effect.sync(isWellDefined));
});
