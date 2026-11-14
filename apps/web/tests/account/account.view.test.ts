import { describe, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  Command,
  Subscription,
  click,
  given,
  label,
  role,
  scene,
  expect as sceneExpect,
  selector,
  text,
  type as typeInto,
} from "foldkit/scene";

import { AccountId } from "@repo/ledger/account-id";
import { LedgerApi } from "@repo/ledger/api";

import { Message } from "#src/account/account.message.js";
import { init, update } from "#src/account/account.update.js";
import { view } from "#src/account/account.view.js";
import { ledger } from "#src/account/ledger.api.js";
import { localLedger } from "#src/server/local-origin.layer.js";

const served = init({
  account: { cursor: 2, state: { balance: 12_000, owner: "Ada", status: "open" } },
  accountId: AccountId.make("acc-1"),
  session: "s",
  theme: "light",
}).model;

const balance = selector("[data-balance]");

const amount = label("Amount (USD)");

const deposit = role("button", { name: "Deposit" });

const withdraw = role("button", { name: "Withdraw" });

const depositConfirmed = ledger.Message.SucceededDepositMoney({
  commandId: "s:0",
  receipt: { stream: "acc-1", version: 3 },
  reply: { balance: 14_550 },
});

const theLedgersRefusal = Effect.fn("theLedgersRefusal")(function* theLedgersRefusalEffect() {
  const client = yield* LedgerApi.clientInProcess;

  yield* client.OpenAccount(served.accountId, { owner: "Ada" });
  yield* client.DepositMoney(served.accountId, { amount: 12_000 });

  const withdrawal = ledger.WithdrawMoney({ commandId: "s:0", input: { amount: 100_000 }, target: served.accountId });

  return yield* withdrawal.effect.pipe(Effect.provideService(LedgerApi.Client, client));
}, Effect.scoped);

const depositCommitted = Message.GotAccount({
  account: { cursor: 3, state: Option.some({ balance: 14_550, owner: "Ada", status: "open" as const }) },
});

const showsTheBalanceFromTheFeedNotTheReply = (): void => {
  scene(
    { update, view },
    given(served),
    sceneExpect(balance).toHaveText("$120.00"),
    typeInto(amount, "25.50"),
    click(deposit),
    sceneExpect(deposit).toBeDisabled(),
    sceneExpect(withdraw).toBeDisabled(),
    Command.resolve(ledger.DepositMoney, depositConfirmed),
    sceneExpect(amount).toHaveValue(""),
    sceneExpect(deposit).toBeEnabled(),
    sceneExpect(balance).toHaveText("$120.00"),
    Subscription.emit(depositCommitted),
    sceneExpect(balance).toHaveText("$145.50"),
  );
};

const showsTheRefusedOverdraft = Effect.fn("showsTheRefusedOverdraft")(function* showsTheRefusedOverdraftCase() {
  const overdraftRefused = yield* theLedgersRefusal();

  scene(
    { update, view },
    given(served),
    typeInto(amount, "1000"),
    click(withdraw),
    Command.resolve(ledger.WithdrawMoney, overdraftRefused),
    sceneExpect(role("alert")).toContainText("Not enough money"),
    sceneExpect(role("alert")).toContainText("The balance is $120.00; you asked for $1,000.00."),
    sceneExpect(balance).toHaveText("$120.00"),
    sceneExpect(withdraw).toBeEnabled(),
    typeInto(amount, "10"),
    sceneExpect(role("alert")).toBeAbsent(),
  );
});

const refusesAnAmountItCannotRead = (): void => {
  scene(
    { update, view },
    given(served),
    typeInto(amount, "12.345"),
    click(deposit),
    Command.expectNone(),
    sceneExpect(role("alert")).toContainText("Enter an amount"),
    sceneExpect(amount).toHaveAttr("aria-invalid", "true"),
  );
};

const showsWhetherTheFeedIsLive = (): void => {
  scene(
    { update, view },
    given(served),
    sceneExpect(text("Live")).toBeAbsent(),
    Subscription.emit(Message.CaughtUp({ cursor: 2 })),
    sceneExpect(text("Live")).toExist(),
    Subscription.emit(Message.FailedFeed({ reason: "RpcClientError" })),
    sceneExpect(text("Updates paused")).toExist(),
    sceneExpect(text("$120.00")).toExist(),
    click(role("button", { name: "Reconnect" })),
    sceneExpect(text("Updates paused")).toBeAbsent(),
    sceneExpect(text("Live")).toBeAbsent(),
  );
};

const answersAnUnknownAccount = (): void => {
  scene(
    { update, view },
    given({ ...served, account: { cursor: 0, state: Option.none() }, accountId: AccountId.make("ghost") }),
    sceneExpect(text("No account ghost")).toExist(),
    sceneExpect(deposit).toBeAbsent(),
  );
};

describe("the account page", () => {
  it.effect("shows a deposit's balance when the feed delivers it, not when the reply arrives", () =>
    Effect.sync(showsTheBalanceFromTheFeedNotTheReply),
  );
  it.effect("refuses an amount it cannot read without sending it", () => Effect.sync(refusesAnAmountItCannotRead));
  it.effect("shows when the feed is live and offers to reconnect when it pauses", () =>
    Effect.sync(showsWhetherTheFeedIsLive),
  );
  it.effect("answers an id with no account instead of waiting", () => Effect.sync(answersAnUnknownAccount));

  it.layer(localLedger)("with the ledger in memory", (withLedger) => {
    withLedger.effect("shows a refused overdraft with the balance and the amount asked for", showsTheRefusedOverdraft);
  });
});
