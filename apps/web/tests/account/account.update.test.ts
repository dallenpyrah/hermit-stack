import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { given, message, model, story } from "foldkit/story";

import { AccountId } from "@repo/ledger/account-id";

import { Message } from "#src/account/account.message.js";
import type { Model } from "#src/account/account.model.js";
import { init, update } from "#src/account/account.update.js";
import { ledger } from "#src/account/ledger.api.js";

type Shown = Readonly<{ balance: number; cursor: number }>;

type Showing = Readonly<{ balance: number | undefined; cursor: number }>;

const served: Model = init({
  account: { cursor: 2, state: { balance: 12_000, owner: "Ada", status: "open" } },
  accountId: AccountId.make("acc-1"),
  session: "s",
  theme: "light",
}).model;

const entry = ({ balance, cursor }: Shown): Message =>
  Message.GotAccount({ account: { cursor, state: Option.some({ balance, owner: "Ada", status: "open" as const }) } });

const shownOf = (shown: Model): Showing => ({
  balance: Option.getOrUndefined(Option.map(shown.account.state, (state) => state.balance)),
  cursor: shown.account.cursor,
});

const theSnapshot: Shown = { balance: 12_000, cursor: 2 };

const third: Shown = { balance: 13_000, cursor: 3 };

const fourth: Shown = { balance: 9000, cursor: 4 };

const confirmed = (commandId: string): typeof ledger.Message.Type =>
  ledger.Message.SucceededDepositMoney({
    commandId,
    receipt: { stream: "acc-1", version: 3 },
    reply: { balance: 13_000 },
  });

const appliesEachEntryOnce = (): void => {
  story(
    update,
    given(served),
    message(entry(third)),
    message(entry(theSnapshot)),
    message(entry(third)),
    model((shown) => {
      expect(shownOf(shown)).toStrictEqual(third);
    }),
    message(entry(fourth)),
    model((shown) => {
      expect(shownOf(shown)).toStrictEqual(fourth);
    }),
  );
};

const commandCount = (step: ReturnType<typeof update>): number => (step.commands ?? []).length;

const sendsOneMovementAtATime = (): void => {
  const firstClick = update({ ...served, amount: "10" }, Message.ClickedDeposit());
  const secondClick = update(firstClick.model, Message.ClickedDeposit());
  const thirdClick = update(secondClick.model, Message.ClickedWithdraw());
  const reply = Message.GotLedgerResult({ result: confirmed("s:0") });
  const settled = update(thirdClick.model, reply);

  expect({
    first: commandCount(firstClick),
    second: commandCount(secondClick),
    sent: settled.model.commandIds.sent,
    third: commandCount(thirdClick),
  }).toStrictEqual({ first: 1, second: 0, sent: 1, third: 0 });
  expect(settled.model.sending).toStrictEqual(Option.none());
};

const ignoresAReplyItIsNotWaitingFor = (): void => {
  const stale = Message.GotLedgerResult({ result: confirmed("s:7") });

  story(
    update,
    given({ ...served, amount: "10" }),
    message(stale),
    model((shown) => {
      expect(shown.amount).toBe("10");
    }),
  );
};

const goesLiveAtTheLaterCursor = (): void => {
  story(
    update,
    given({ ...served, feed: "Paused" }),
    message(Message.CaughtUp({ cursor: 1 })),
    model((shown) => {
      expect({ cursor: shown.account.cursor, feed: shown.feed }).toStrictEqual({ cursor: 2, feed: "Live" });
    }),
  );
};

const startsEmptyFromASnapshotItCannotRead = (): void => {
  const { model: started } = init({
    account: { cursor: 5, state: { balance: "lots" } },
    accountId: AccountId.make("acc-1"),
    session: "s",
    theme: "dark",
  });

  expect(started.account).toStrictEqual({ cursor: 0, state: Option.none() });
};

describe("the account page's updates", () => {
  it.effect("applies each feed entry once, however often it arrives", () => Effect.sync(appliesEachEntryOnce));
  it.effect("sends one movement at a time", () => Effect.sync(sendsOneMovementAtATime));
  it.effect("ignores a reply to a command it is not waiting for", () => Effect.sync(ignoresAReplyItIsNotWaitingFor));
  it.effect("goes live without moving its cursor back", () => Effect.sync(goesLiveAtTheLaterCursor));
  it.effect("starts empty at cursor zero from a snapshot it cannot read", () =>
    Effect.sync(startsEmptyFromASnapshotItCannotRead),
  );
});
