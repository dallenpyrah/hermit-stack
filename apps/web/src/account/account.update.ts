import { next as nextCommandId } from "@alchemy.run/domain/Foldkit";
import type { Failure } from "@alchemy.run/domain/Foldkit";
import { Function as Fn, Match, Number as Num, Option, pipe } from "effect";
import { mapMessage } from "foldkit/command";
import type { Return } from "foldkit/update";

import type { LedgerApi } from "@repo/ledger/api";

import type { AccountSnapshot, Flags, Model, Movement, Notice } from "#src/account/account.model.js";
import { Denied, InvalidAmount, Unconfirmed } from "#src/account/account.model.js";
import { Message } from "#src/account/account.message.js";
import type { Ledger } from "#src/account/ledger.api.js";
import { ledger } from "#src/account/ledger.api.js";
import { parseDollars } from "#src/account/money.pure.js";

type Step = Return<Model, Message, Ledger>;

type LedgerResult = typeof ledger.Message.Type;

type LedgerFailure = Failure<(typeof LedgerApi.commands)[number]>;

const fromFirstEvent: AccountSnapshot = { cursor: 0, state: Option.none() };

const init = (flags: Flags): Step => ({
  model: {
    account: Option.getOrElse(ledger.Balance.decodeSnapshotFlags(flags.account), () => fromFirstEvent),
    accountId: flags.accountId,
    amount: "",
    commandIds: { sent: 0, session: flags.session },
    feed: "Seeded",
    notice: Option.none(),
    sending: Option.none(),
    theme: flags.theme,
  },
});

const toResult = (result: LedgerResult): Message => Message.GotLedgerResult({ result });

const send = (model: Model, movement: Movement, amount: number): Step => {
  const { commandId, commandIds } = nextCommandId(model.commandIds);
  const args = { commandId, input: { amount }, target: model.accountId };

  const command = Match.value(movement).pipe(
    Match.when("DepositMoney", () => mapMessage(ledger.DepositMoney(args), toResult)),
    Match.orElse(() => mapMessage(ledger.WithdrawMoney(args), toResult)),
  );

  return {
    commands: [command],
    model: { ...model, commandIds, notice: Option.none(), sending: Option.some({ commandId, movement }) },
  };
};

const move = (model: Model, movement: Movement): Step =>
  Option.match(model.sending, {
    onNone: () =>
      Option.match(parseDollars(model.amount), {
        onNone: () => ({ model: { ...model, notice: Option.some<Notice>(InvalidAmount.make({})) } }),
        onSome: (amount) => send(model, movement, amount),
      }),
    onSome: () => ({ model }),
  });

const noticeOf = (failure: LedgerFailure): Notice =>
  Match.valueTags(failure, {
    Denied: (): Notice => Denied.make({}),
    Rejected: ({ rejection }): Notice => rejection,
    Unknown: (): Notice => Unconfirmed.make({}),
  });

const failureOf = (result: LedgerResult): Option.Option<LedgerFailure> =>
  Match.value(result).pipe(
    Match.tagStartsWith("Failed", ({ failure }): Option.Option<LedgerFailure> => Option.some(failure)),
    Match.orElse(() => Option.none()),
  );

const settle = (model: Model, result: LedgerResult): Step => {
  const isCurrent = Option.exists(model.sending, ({ commandId }) => commandId === result.commandId);

  if (!isCurrent) {
    return { model };
  }

  return Option.match(failureOf(result), {
    onNone: () => ({ model: { ...model, amount: "", notice: Option.none(), sending: Option.none() } }),
    onSome: (failure) => ({ model: { ...model, notice: Option.some(noticeOf(failure)), sending: Option.none() } }),
  });
};

const receive = (model: Model, account: AccountSnapshot): Step => ({
  model: Option.match(
    Option.liftPredicate(account, ({ cursor }) => cursor > model.account.cursor),
    { onNone: () => model, onSome: (newer) => ({ ...model, account: newer }) },
  ),
});

const caughtUp = (model: Model, cursor: number): Step => ({
  model: {
    ...model,
    account: { ...model.account, cursor: pipe(model.account.cursor, Num.max(cursor)) },
    feed: "Live",
  },
});

const updateArity = 2;

const update: {
  (message: Message): (model: Model) => Step;
  (model: Model, message: Message): Step;
} = Fn.dual(updateArity, (model: Model, message: Message): Step =>
  Message.match(message, {
    CaughtUp: ({ cursor }): Step => caughtUp(model, cursor),
    ChangedAmount: ({ value }): Step => ({ model: { ...model, amount: value, notice: Option.none() } }),
    ClickedDeposit: (): Step => move(model, "DepositMoney"),
    ClickedReconnect: (): Step => ({ model: { ...model, feed: "Seeded" } }),
    ClickedWithdraw: (): Step => move(model, "WithdrawMoney"),
    FailedFeed: (): Step => ({ model: { ...model, feed: "Paused" } }),
    GotAccount: ({ account }): Step => receive(model, account),
    GotLedgerResult: ({ result }): Step => settle(model, result),
  }),
);

export { init, update };
