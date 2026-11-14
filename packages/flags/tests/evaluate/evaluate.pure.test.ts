import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option, Schema } from "effect";

import { evaluate } from "#src/evaluate/evaluate.pure.js";
import { Flag } from "#src/flag/flag.pure.js";

const Rollout = Flag.release("ledger.instant-withdrawals", Schema.Boolean, {
  default: false,
  owner: "ledger",
  purpose: "Exercise the evaluator.",
  removeBy: "2999-01-01",
});

const Mode = Flag.release("checkout.mode", Schema.Literals(["classic", "express", "beta"]), {
  default: "classic",
  owner: "checkout",
  purpose: "Exercise rules with values other than the default.",
  removeBy: "2999-01-01",
});

const atPercentage = (percentage: number, subject: string): boolean =>
  evaluate(Rollout, [{ percentage, value: true }], Option.some(subject));

const small = 20;
const large = 30;
const subjectCount = 1000;
const fewest = 170;
const most = 230;

const belowUserOne = 50;
const aboveUserOne = 51;

const subject = Schema.NonEmptyString;
const percentage = Schema.Int.check(Schema.isBetween({ maximum: 100, minimum: 0 }));

const stableAcrossCalls = ({ id, share }: { readonly id: string; readonly share: number }): boolean => {
  const first = atPercentage(share, id);

  atPercentage(share, `${id}:another`);

  return atPercentage(share, id) === first;
};

const stillIncludedAtThirty = ({ id }: { readonly id: string }): boolean =>
  !atPercentage(small, id) || atPercentage(large, id);

const neverDropsWhenGrowing = ({
  id,
  first,
  second,
}: {
  readonly first: number;
  readonly id: string;
  readonly second: number;
}): boolean => !atPercentage(Math.min(first, second), id) || atPercentage(Math.max(first, second), id);

const cutsAtTheBucket = (): void => {
  expect(atPercentage(belowUserOne, "user-1")).toBe(false);
  expect(atPercentage(aboveUserOne, "user-1")).toBe(true);
};

const reachesItsShare = (): void => {
  const reached = Arr.filter(
    Arr.makeBy(subjectCount, (index) => `user-${index}`),
    (id) => atPercentage(small, id),
  );

  expect(reached.length).toBeGreaterThan(fewest);
  expect(reached.length).toBeLessThan(most);
};

const listedSubjectWins = (): void => {
  const rules = [
    { subjects: ["user-7"], value: "beta" as const },
    { percentage: 100, value: "express" as const },
  ];

  expect(evaluate(Mode, rules, Option.some("user-7"))).toBe("beta");
  expect(evaluate(Mode, rules, Option.some("user-8"))).toBe("express");
};

const anonymousGetsDefault = (): void => {
  expect(evaluate(Mode, [{ percentage: 100, value: "express" as const }], Option.none())).toBe("classic");
  expect(evaluate(Mode, [{ subjects: ["user-7"], value: "beta" as const }], Option.none())).toBe("classic");
};

const unconditionalReachesEveryone = (): void => {
  expect(evaluate(Mode, [{ value: "express" as const }], Option.none())).toBe("express");
  expect(evaluate(Mode, [{ value: "express" as const }], Option.some("user-8"))).toBe("express");
};

describe("evaluating a flag's rules", () => {
  it.prop("gives a subject the same answer on every call", { id: subject, share: percentage }, stableAcrossCalls);
  it.prop("keeps a subject included at 20% when the rollout grows to 30%", { id: subject }, stillIncludedAtThirty);
  it.prop(
    "never drops a subject when the percentage grows",
    { first: percentage, id: subject, second: percentage },
    neverDropsWhenGrowing,
  );
  it.effect("includes a subject exactly when its bucket is below the percentage", () => Effect.sync(cutsAtTheBucket));
  it.effect("reaches about its percentage of consecutive subject ids", () => Effect.sync(reachesItsShare));
  it.effect("lets the first matching rule win", () => Effect.sync(listedSubjectWins));
  it.effect("answers a read with no subject with the default", () => Effect.sync(anonymousGetsDefault));
  it.effect("applies a rule with no conditions to everyone", () => Effect.sync(unconditionalReachesEveryone));
});
