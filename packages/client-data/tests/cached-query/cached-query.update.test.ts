import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option, Result, Schema } from "effect";
import { AsyncData, Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import { Command, given, message, model, steps, story } from "foldkit/story";
import type { StoryStep } from "foldkit/story";

import { define } from "#src/cached-query/cached-query.update.js";

// A story never runs a Command: it answers each one, so the clock and the network are whatever the story says they are.
const balances = define({
  args: { accountId: Schema.String },
  data: Schema.Finite,
  error: Schema.String,
  execute: () => Effect.fail("A story answers the Fetch itself."),
  maxEntries: 2,
  name: "Balance",
  staleTime: "30 seconds",
  toKey: ({ accountId }) => accountId,
});

type Model = typeof balances.Model.Type;

type BalanceMessage = typeof balances.Message.Type;

type QueryMessage = typeof balances.query.Message.Type;

type FetchCommand = ReturnType<typeof balances.query.Fetch>;

interface Reply {
  readonly accountId: string;
  readonly balance: number;
  readonly fetchedAt: number;
  readonly generation: number;
}

interface Check {
  readonly accountId: string;
  readonly now: number;
}

const requested = (accountId: string): BalanceMessage => balances.Message.Requested({ args: { accountId } });

const checkedAt = ({ accountId, now }: Check): BalanceMessage =>
  balances.Message.CheckedFreshness({ args: { accountId }, now });

const fetchOf = ({ accountId, generation }: Pick<Reply, "accountId" | "generation">): FetchCommand =>
  balances.query.Fetch({ args: { accountId }, generation });

const reply = ({ accountId, balance, fetchedAt, generation }: Reply): QueryMessage =>
  balances.query.Message.CompletedFetch({
    args: { accountId },
    generation,
    result: Result.succeed({ fetchedAt, value: balance }),
  });

const loaded = (answer: Reply): StoryStep<Model, BalanceMessage, undefined> =>
  steps(message(requested(answer.accountId)), Command.resolve(fetchOf(answer), reply(answer)));

const balanceOf = (current: Model, accountId: string): AsyncData.AsyncData<number, string> =>
  balances.read(current, { accountId });

// The stale time is 30 seconds and the first reply arrives at 1000 ms, so 30 999 ms is the last fresh moment.
const firstReply = { accountId: "a", balance: 40, fetchedAt: 1000, generation: 1 };

const refreshReply = { accountId: "a", balance: 65, fetchedAt: 31_050, generation: 2 };

const staleTimeDecides = (): void => {
  story(
    balances.update,
    given(balances.init()),
    loaded(firstReply),
    message(requested("a")),
    Command.resolve(balances.CheckFreshness, checkedAt({ accountId: "a", now: 30_999 })),
    Command.expectNone(),
    message(requested("a")),
    Command.resolve(balances.CheckFreshness, checkedAt({ accountId: "a", now: 31_000 })),
    Command.expectExact(fetchOf(refreshReply)),
    model((current: Model) => {
      expect(balanceOf(current, "a")).toStrictEqual(AsyncData.Refreshing({ data: 40 }));
    }),
    Command.resolve(fetchOf(refreshReply), reply(refreshReply)),
    model((current: Model) => {
      expect(balanceOf(current, "a")).toStrictEqual(AsyncData.Success({ data: 65 }));
    }),
  );
};

const capDropsLeastRecentlyUsed = (): void => {
  story(
    balances.update,
    given(balances.init()),
    loaded({ accountId: "a", balance: 40, fetchedAt: 1000, generation: 1 }),
    loaded({ accountId: "b", balance: 50, fetchedAt: 2000, generation: 2 }),
    message(requested("a")),
    Command.resolve(balances.CheckFreshness, checkedAt({ accountId: "a", now: 3000 })),
    loaded({ accountId: "c", balance: 60, fetchedAt: 4000, generation: 3 }),
    model((current: Model) => {
      expect(balanceOf(current, "a")).toStrictEqual(AsyncData.Success({ data: 40 }));
      expect(balanceOf(current, "b")).toStrictEqual(AsyncData.Idle());
      expect(balanceOf(current, "c")).toStrictEqual(AsyncData.Success({ data: 60 }));
      expect(current.recent).toStrictEqual(["a", "c"]);
    }),
  );
};

// A screen that requests every balance it shows when it opens, and revalidates them when the page regains focus. A
// Story sends one Message at a time, so reads that overlap are reads made in one update, as when two parts of one screen
// Show the same account.
const Screen = defineMessageUnion({
  GotBalancesMessage: { message: balances.Message },
  Opened: {},
  RegainedFocus: { now: Schema.Finite },
});

type Screen = typeof Screen.Type;

type ScreenModel = Readonly<{ balances: Model; shown: readonly string[] }>;

type ScreenReturn = Update.Return<ScreenModel, Screen>;

const foldBalances = Update.foldChild({
  read: (current: ScreenModel) => Option.some(current.balances),
  toParentMessage: (child: BalanceMessage) => Screen.GotBalancesMessage({ message: child }),
  update: balances.update,
  write: (current: ScreenModel, next: Model): ScreenModel => ({ ...current, balances: next }),
});

const requestShown = (accountId: string): Update.Step<ScreenModel, Screen> => foldBalances(requested(accountId));

const checkShownAt =
  (now: number) =>
  (accountId: string): Update.Step<ScreenModel, Screen> =>
    foldBalances(checkedAt({ accountId, now }));

const opened = (current: ScreenModel): ScreenReturn => Update.combine(current, Arr.map(current.shown, requestShown));

const regainedFocus = (current: ScreenModel, now: number): ScreenReturn =>
  Update.combine(current, Arr.map(current.shown, checkShownAt(now)));

const screenUpdate = (current: ScreenModel, screenMessage: Screen): ScreenReturn =>
  Screen.match<ScreenReturn>(screenMessage, {
    GotBalancesMessage: ({ message: child }) => foldBalances(current, child),
    Opened: () => opened(current),
    RegainedFocus: ({ now }) => regainedFocus(current, now),
  });

const shownLoaded = (answer: Reply): StoryStep<ScreenModel, Screen, undefined> => {
  const shown = Screen.GotBalancesMessage({ message: requested(answer.accountId) });

  return steps(message(shown), Command.resolve(fetchOf(answer), reply(answer)));
};

const concurrentReadsShareOneRequest = (): void => {
  story(
    screenUpdate,
    given({ balances: balances.init(), shown: ["a", "a"] }),
    message(Screen.Opened()),
    Command.expectExact(fetchOf(firstReply)),
    Command.resolve(fetchOf(firstReply), reply(firstReply)),
    model((current: ScreenModel) => {
      expect(balanceOf(current.balances, "a")).toStrictEqual(AsyncData.Success({ data: 40 }));
    }),
  );
};

// With a cap of two, reading a, b, c and a again drops a and then b, so the second read of a is a newer request for a
// While the first is still in flight.
const olderReply = { accountId: "a", balance: 40, fetchedAt: 1000, generation: 1 };

const newerReply = { accountId: "a", balance: 65, fetchedAt: 1200, generation: 4 };

const lateReplyIsDropped = (): void => {
  story(
    screenUpdate,
    given({ balances: balances.init(), shown: ["a", "b", "c", "a"] }),
    message(Screen.Opened()),
    Command.resolve(fetchOf(olderReply), reply(olderReply)),
    model((current: ScreenModel) => {
      expect(balanceOf(current.balances, "a")).toStrictEqual(AsyncData.Loading());
    }),
    Command.resolve(fetchOf(newerReply), reply(newerReply)),
    Command.resolveAll(
      [
        fetchOf({ accountId: "b", generation: 2 }),
        reply({ accountId: "b", balance: 50, fetchedAt: 1300, generation: 2 }),
      ],
      [
        fetchOf({ accountId: "c", generation: 3 }),
        reply({ accountId: "c", balance: 60, fetchedAt: 1400, generation: 3 }),
      ],
    ),
    model((current: ScreenModel) => {
      expect(balanceOf(current.balances, "a")).toStrictEqual(AsyncData.Success({ data: 65 }));
      expect(balanceOf(current.balances, "b")).toStrictEqual(AsyncData.Idle());
      expect(balanceOf(current.balances, "c")).toStrictEqual(AsyncData.Success({ data: 60 }));
    }),
  );
};

// At 31 000 ms, a (replied at 0) is 31 seconds old and b (replied at 20 000) is 11 seconds old.
const focusRevalidatesOnlyStale = (): void => {
  const staleReply = { accountId: "a", balance: 41, fetchedAt: 31_100, generation: 3 };

  story(
    screenUpdate,
    given({ balances: balances.init(), shown: ["a", "b"] }),
    shownLoaded({ accountId: "a", balance: 40, fetchedAt: 0, generation: 1 }),
    shownLoaded({ accountId: "b", balance: 40, fetchedAt: 20_000, generation: 2 }),
    message(Screen.RegainedFocus({ now: 31_000 })),
    Command.expectExact(fetchOf(staleReply)),
    Command.resolve(fetchOf(staleReply), reply(staleReply)),
    model((current: ScreenModel) => {
      expect(balanceOf(current.balances, "a")).toStrictEqual(AsyncData.Success({ data: 41 }));
      expect(balanceOf(current.balances, "b")).toStrictEqual(AsyncData.Success({ data: 40 }));
    }),
  );
};

describe("a cached query", () => {
  it.effect("serves a read inside the stale time from the Model, and sends one request just past it", () =>
    Effect.sync(staleTimeDecides),
  );
  it.effect("sends one request for two reads of one key at once", () => Effect.sync(concurrentReadsShareOneRequest));
  it.effect("drops the least recently used entry when it goes over its cap", () =>
    Effect.sync(capDropsLeastRecentlyUsed),
  );
  it.effect("drops a reply to an older request while a newer one for the same key is in flight", () =>
    Effect.sync(lateReplyIsDropped),
  );
  it.effect("revalidates a stale entry on focus and leaves a fresh one alone", () =>
    Effect.sync(focusRevalidatesOnlyStale),
  );
});
