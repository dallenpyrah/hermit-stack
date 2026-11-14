import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";

import { formatCents, parseCents } from "#src/account/money.pure.js";

const amounts = [
  { cents: 1200, text: "12" },
  { cents: 1250, text: "12.5" },
  { cents: 1205, text: "12.05" },
  { cents: 1, text: " $0.01 " },
];

const notAmounts = ["0", "12.345", "-5", "five", ""];

const readsDollarsAsCents = (): void => {
  const read = Arr.map(amounts, ({ text }) => parseCents(text));

  expect(read).toStrictEqual(Arr.map(amounts, ({ cents }) => Option.some(cents)));
};

const refusesWhatIsNotAnAmount = (): void => {
  expect(Arr.map(notAmounts, parseCents)).toStrictEqual(Arr.map(notAmounts, () => Option.none()));
};

const writesCentsAsDollars = (): void => {
  const written = Arr.map([{ cents: 750 }, { cents: 123_456 }], ({ cents }) => formatCents(cents));

  expect(written).toStrictEqual(["$7.50", "$1,234.56"]);
};

describe("amounts of money", () => {
  it.effect("reads dollars with up to two decimals as whole cents", () => Effect.sync(readsDollarsAsCents));
  it.effect("refuses zero, a third decimal, a sign and words", () => Effect.sync(refusesWhatIsNotAnAmount));
  it.effect("writes cents as dollars", () => Effect.sync(writesCentsAsDollars));
});
