import { describe, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  Command,
  Subscription,
  click,
  expect as sceneExpect,
  given,
  label,
  role,
  scene,
  text,
  type,
} from "foldkit/scene";

import { Move } from "#src/account/account.command.js";
import { Message } from "#src/account/account.message.js";
import { Account } from "#src/account/account.model.js";
import type { Model } from "#src/account/account.model.js";
import { init, update } from "#src/account/account.update.js";
import { view } from "#src/account/account.view.js";

const app = { update, view };

const waiting = init().model;

const ada = Option.some("ada");

const open: Model = {
  ...waiting,
  account: Account.Loaded({ balance: 500, owner: ada, status: "open" }),
  key: Option.some("acct-1"),
};

const waitsForTheLedger = (): void => {
  scene(
    app,
    given(waiting),
    sceneExpect(text("Waiting for the ledger's answer.")).toExist(),
    sceneExpect(role("button", { name: "Deposit" })).toBeAbsent(),
  );
};

const showsTheToolResult = (): void => {
  scene(
    app,
    given(waiting),
    Subscription.emit(Message.GotAccountKey({ key: "acct-1" })),
    Subscription.emit(Message.GotBalance({ balance: 500, owner: ada, status: "open" })),
    sceneExpect(role("heading", { name: "acct-1" })).toExist(),
    sceneExpect(text("$5.00")).toExist(),
    sceneExpect(text("Owned by ada")).toExist(),
    sceneExpect(text("Open")).toExist(),
    sceneExpect(role("button", { name: "Deposit" })).not.toBeDisabled(),
  );
};

const depositsAndShowsTheNewBalance = (): void => {
  scene(
    app,
    given(open),
    type(label("Amount"), "2.50"),
    click(role("button", { name: "Deposit" })),
    Command.expectExact(Move({ amount: 250, key: "acct-1", kind: "deposit" })),
    sceneExpect(role("button", { name: "Depositing…" })).toBeDisabled(),
    sceneExpect(role("button", { name: "Withdraw" })).toBeDisabled(),
    Command.resolve(Move, Message.Moved({ amount: 250, balance: 750, kind: "deposit" })),
    sceneExpect(text("$7.50")).toExist(),
    sceneExpect(role("alert")).toHaveText("Deposited $2.50"),
    sceneExpect(label("Amount")).toHaveValue(""),
  );
};

const showsAnOverdraftAsRefused = (): void => {
  scene(
    app,
    given(open),
    type(label("Amount"), "9"),
    click(role("button", { name: "Withdraw" })),
    Command.expectExact(Move({ amount: 900, key: "acct-1", kind: "withdraw" })),
    Command.resolve(Move, Message.RefusedMove({ reason: "The balance is $5.00, so $9.00 cannot be withdrawn." })),
    sceneExpect(role("alert")).toHaveText("RefusedThe balance is $5.00, so $9.00 cannot be withdrawn."),
    sceneExpect(text("$5.00")).toExist(),
    sceneExpect(role("button", { name: "Withdraw" })).not.toBeDisabled(),
  );
};

const refusesAnAmountItCannotRead = (): void => {
  scene(
    app,
    given(open),
    type(label("Amount"), "12.345"),
    click(role("button", { name: "Deposit" })),
    Command.expectNone(),
    sceneExpect(text("That is not an amount")).toExist(),
    sceneExpect(label("Amount")).toHaveAttr("aria-invalid", "true"),
  );
};

const closed: Model = { ...open, account: Account.Loaded({ balance: 0, owner: ada, status: "closed" }) };

const closedAccountTakesNoMovement = (): void => {
  scene(
    app,
    given(closed),
    sceneExpect(text("Closed")).toExist(),
    sceneExpect(role("button", { name: "Deposit" })).toBeAbsent(),
    sceneExpect(label("Amount")).toBeAbsent(),
  );
};

const followsTheHostTheme = (): void => {
  scene(
    app,
    given(open),
    sceneExpect(role("main")).toHaveAttr("data-theme", "light"),
    Subscription.emit(Message.ChangedTheme({ theme: "dark" })),
    sceneExpect(role("main")).toHaveAttr("data-theme", "dark"),
  );
};

const saysWhenTheAccountCannotBeRead = (): void => {
  scene(
    app,
    given(waiting),
    Subscription.emit(Message.FailedToLoad({ reason: "The host cancelled the call." })),
    sceneExpect(role("alert")).toHaveText("The account could not be readThe host cancelled the call."),
  );
};

describe("the account panel", () => {
  it.effect("waits for the ledger before it shows an account", () => Effect.sync(waitsForTheLedger));
  it.effect("shows the balance from the agent's Balance.get result", () => Effect.sync(showsTheToolResult));
  it.effect("deposits through the host and shows the new balance", () => Effect.sync(depositsAndShowsTheNewBalance));
  it.effect("shows an overdraft the ledger refused, keeping the balance", () => Effect.sync(showsAnOverdraftAsRefused));
  it.effect("refuses an amount it cannot read without calling the ledger", () =>
    Effect.sync(refusesAnAmountItCannotRead),
  );
  it.effect("offers no deposit or withdrawal for a closed account", () => Effect.sync(closedAccountTakesNoMovement));
  it.effect("follows the host's theme", () => Effect.sync(followsTheHostTheme));
  it.effect("says when the account cannot be read", () => Effect.sync(saysWhenTheAccountCannotBeRead));
});
