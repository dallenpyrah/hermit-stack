import { InMemory } from "@alchemy.run/domain";
import { expect } from "@effect/vitest";
import type { Vitest } from "@effect/vitest";
import { Effect, Layer, Number as Num, Option, Record as Rec, String as Str } from "effect";
import { TestClock } from "effect/testing";

import { SessionAdapter } from "#src/session-adapter.service.js";
import type { Session } from "#src/session.middleware.js";
import type { UserId } from "#src/user.id.js";
import { VisitsApi } from "#src/visits.api.js";
import { VisitsModel } from "#src/visits.model.js";

const visitsModel = VisitsModel.layer(Layer.empty).pipe(Layer.provide(InMemory));

type SessionTarget = Layer.Success<typeof visitsModel> | Session | SessionAdapter;

const sessionTarget = <Failure>(
  adapter: Layer.Layer<Session | SessionAdapter, Failure>,
): Layer.Layer<SessionTarget, Failure> => Layer.merge(adapter, visitsModel);

const signUp = Effect.fn("signUp")(function* signUp(name: string) {
  const adapter = yield* SessionAdapter;

  return yield* adapter.signUp(name);
});

const checkIn = Effect.fn("checkIn")(function* checkIn(userId: UserId, headers: Rec.ReadonlyRecord<string, string>) {
  const api = yield* VisitsApi.clientInProcess;
  const receipt = yield* api.CheckIn(userId, {}, { headers });

  return receipt.reply;
});

const refusal = Effect.fn("refusal")(function* refusal(userId: UserId, headers: Rec.ReadonlyRecord<string, string>) {
  return yield* Effect.flip(checkIn(userId, headers));
});

const swapped = (character: string): string =>
  Option.getOrElse(
    Option.filter(Option.some("a"), (replacement) => replacement !== character),
    () => "b",
  );

const tamperedAt = (
  headers: Rec.ReadonlyRecord<string, string>,
  indexOf: (value: string) => number,
): Rec.ReadonlyRecord<string, string> =>
  Rec.map(headers, (value) => {
    const index = indexOf(value);
    const next = Num.increment(index);

    return `${Str.takeLeft(index)(value)}${swapped(Str.slice(index, next)(value))}${Str.slice(next)(value)}`;
  });

const halves = 2;

const middleOf = (value: string): number => Math.floor(value.length / halves);

const lastOf = (value: string): number => Num.decrement(value.length);

const yieldsItsUser = Effect.gen(function* yieldsItsUserCase() {
  const sam = yield* signUp("Sam");
  const alex = yield* signUp("Alex");
  const samFirst = yield* checkIn(sam.userId, sam.headers);
  const alexFirst = yield* checkIn(alex.userId, alex.headers);
  const samAsAlex = yield* refusal(alex.userId, sam.headers);

  expect(sam.userId).not.toBe(alex.userId);
  expect(samFirst).toStrictEqual({ name: "Sam", visits: 1 });
  expect(alexFirst).toStrictEqual({ name: "Alex", visits: 1 });
  expect(samAsAlex).toHaveProperty("_tag", "NotYou");
});

const refusesNoSession = Effect.gen(function* refusesNoSessionCase() {
  const sam = yield* signUp("Sam");
  const refused = yield* refusal(sam.userId, {});

  expect(refused).toHaveProperty("_tag", "Unauthorized");
});

const refusesTamperedSession = Effect.gen(function* refusesTamperedSessionCase() {
  const sam = yield* signUp("Sam");
  const middle = tamperedAt(sam.headers, middleOf);
  const last = tamperedAt(sam.headers, lastOf);
  const middleRefused = yield* refusal(sam.userId, middle);
  const lastRefused = yield* refusal(sam.userId, last);
  const untouched = yield* checkIn(sam.userId, sam.headers);

  expect([middle, last]).not.toContainEqual(sam.headers);
  expect(middleRefused).toHaveProperty("_tag", "Unauthorized");
  expect(lastRefused).toHaveProperty("_tag", "Unauthorized");
  expect(untouched).toStrictEqual({ name: "Sam", visits: 1 });
});

const refusesExpiredSession = Effect.gen(function* refusesExpiredSessionCase() {
  const adapter = yield* SessionAdapter;
  const sam = yield* signUp("Sam");
  const alex = yield* signUp("Alex");
  const beforeExpiry = yield* checkIn(sam.userId, sam.headers);

  yield* adapter.expire(sam);

  const afterExpiry = yield* refusal(sam.userId, sam.headers);
  const alexStill = yield* checkIn(alex.userId, alex.headers);

  expect(beforeExpiry).toStrictEqual({ name: "Sam", visits: 1 });
  expect(afterExpiry).toHaveProperty("_tag", "Unauthorized");
  expect(alexStill).toStrictEqual({ name: "Alex", visits: 1 });
});

const contractCases = {
  "a request whose session expired is refused, and other sessions still work": refusesExpiredSession,
  "a request whose session was altered is refused as Unauthorized": refusesTamperedSession,
  "a request with a session gets the user it belongs to, and only that user": yieldsItsUser,
  "a request with no session is refused as Unauthorized": refusesNoSession,
} as const;

const sessionContract = (onTarget: Vitest.MethodsNonLive<SessionTarget>): void => {
  for (const [title, contractCase] of Rec.toEntries(contractCases)) {
    onTarget.effect(title, () => TestClock.withLive(contractCase));
  }
};

export { sessionContract, sessionTarget };
