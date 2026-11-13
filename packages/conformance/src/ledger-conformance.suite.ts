import { expect } from "@effect/vitest";
import type { Vitest } from "@effect/vitest";
import { Effect, Random, Record as Rec } from "effect";
import type { Layer } from "effect";
import { TestClock } from "effect/testing";

import { AccountId } from "@repo/ledger/account-id";
import { LedgerApi } from "@repo/ledger/api";

import { guaranteeTitles } from "#src/guarantee-titles.pure.js";
import type { GuaranteeName } from "#src/guarantee-titles.pure.js";

type LedgerClient = Layer.Success<typeof LedgerApi.layerClient>;

// A target is whatever provides the typed client: in process over a host, over HTTP to a server, or a deployed stage.
type Target<Failure> = Layer.Layer<LedgerClient, Failure>;

interface Receipt {
  readonly stream: string;
  readonly version: number;
}

interface ReadAtReceipt {
  readonly atLeast: Receipt;
}

// A view catches up after the commit, so a read that must see a write waits for that write's receipt.
const atReceipt = (receipt: Receipt): ReadAtReceipt => ({
  atLeast: { stream: receipt.stream, version: receipt.version },
});

// The cases share one build of the target, and a deployed stage keeps its accounts between runs, so every case opens an
// Account no other case or earlier run has used.
const freshAccount = Effect.map(Random.nextInt, (suffix) => AccountId.make(`conformance-${suffix}`));

const opensAtZero = Effect.gen(function* opensAtZeroCase() {
  const ledger = yield* LedgerApi.Client;
  const account = yield* freshAccount;
  const receipt = yield* ledger.OpenAccount(account, { owner: "sam" });
  const balance = yield* ledger.Balance.get(account, atReceipt(receipt));

  expect(balance).toStrictEqual({ balance: 0, owner: "sam", status: "open" });
});

const depositReplies = Effect.gen(function* depositRepliesCase() {
  const ledger = yield* LedgerApi.Client;
  const account = yield* freshAccount;

  yield* ledger.OpenAccount(account, { owner: "sam" });
  yield* ledger.DepositMoney(account, { amount: 40 });

  const receipt = yield* ledger.DepositMoney(account, { amount: 25 });
  const balance = yield* ledger.Balance.get(account, atReceipt(receipt));

  expect(receipt.reply).toStrictEqual({ balance: 65 });
  expect(balance).toMatchObject({ balance: 65 });
});

const overdraftRefused = Effect.gen(function* overdraftRefusedCase() {
  const ledger = yield* LedgerApi.Client;
  const account = yield* freshAccount;

  const [, receipt] = yield* Effect.all([
    ledger.OpenAccount(account, { owner: "sam" }),
    ledger.DepositMoney(account, { amount: 50 }),
  ]);

  const refused = yield* Effect.flip(ledger.WithdrawMoney(account, { amount: 51 }));
  const balance = yield* ledger.Balance.get(account, atReceipt(receipt));
  const emptied = yield* ledger.WithdrawMoney(account, { amount: 50 });

  expect(refused).toHaveProperty("_tag", "InsufficientFunds");
  expect(refused).toMatchObject({ balance: 50, requested: 51 });
  expect(balance).toMatchObject({ balance: 50 });
  expect(emptied.reply).toStrictEqual({ balance: 0 });
});

const opensOnce = Effect.gen(function* opensOnceCase() {
  const ledger = yield* LedgerApi.Client;
  const account = yield* freshAccount;
  const receipt = yield* ledger.OpenAccount(account, { owner: "sam" });
  const refused = yield* Effect.flip(ledger.OpenAccount(account, { owner: "ada" }));
  const balance = yield* ledger.Balance.get(account, atReceipt(receipt));

  expect(refused).toHaveProperty("_tag", "AlreadyOpen");
  expect(balance).toMatchObject({ owner: "sam" });
});

const closesOnlyWhenEmpty = Effect.gen(function* closesOnlyWhenEmptyCase() {
  const ledger = yield* LedgerApi.Client;
  const account = yield* freshAccount;

  yield* Effect.all([ledger.OpenAccount(account, { owner: "sam" }), ledger.DepositMoney(account, { amount: 10 })]);

  const stillHolding = yield* Effect.flip(ledger.CloseAccount(account));

  yield* ledger.WithdrawMoney(account, { amount: 10 });

  const receipt = yield* ledger.CloseAccount(account);
  const balance = yield* ledger.Balance.get(account, atReceipt(receipt));

  expect(stillHolding).toMatchObject({ balance: 10 });
  expect(stillHolding).toHaveProperty("_tag", "BalanceNotZero");
  expect(balance).toStrictEqual({ balance: 0, owner: "sam", status: "closed" });
});

const closedRefusesMoney = Effect.gen(function* closedRefusesMoneyCase() {
  const ledger = yield* LedgerApi.Client;
  const account = yield* freshAccount;

  yield* ledger.OpenAccount(account, { owner: "sam" });
  yield* ledger.CloseAccount(account);

  const deposit = yield* Effect.flip(ledger.DepositMoney(account, { amount: 1 }));
  const withdrawal = yield* Effect.flip(ledger.WithdrawMoney(account, { amount: 1 }));
  const closing = yield* Effect.flip(ledger.CloseAccount(account));

  expect(deposit).toHaveProperty("_tag", "NotOpen");
  expect(withdrawal).toHaveProperty("_tag", "NotOpen");
  expect(closing).toHaveProperty("_tag", "NotOpen");
});

const neverOpened = Effect.gen(function* neverOpenedCase() {
  const ledger = yield* LedgerApi.Client;
  const account = yield* freshAccount;
  const deposit = yield* Effect.flip(ledger.DepositMoney(account, { amount: 1 }));
  const withdrawal = yield* Effect.flip(ledger.WithdrawMoney(account, { amount: 1 }));
  const balance = yield* ledger.Balance.get(account);

  expect(deposit).toHaveProperty("_tag", "NotOpen");
  expect(withdrawal).toHaveProperty("_tag", "NotOpen");
  expect(balance).toBeNull();
});

const retriedCommandId = Effect.gen(function* retriedCommandIdCase() {
  const ledger = yield* LedgerApi.Client;
  const account = yield* freshAccount;

  yield* ledger.OpenAccount(account, { owner: "sam" });

  const first = yield* ledger.DepositMoney(account, { amount: 30 }, { commandId: `${account}-deposit` });
  const retried = yield* ledger.DepositMoney(account, { amount: 30 }, { commandId: `${account}-deposit` });
  const next = yield* ledger.DepositMoney(account, { amount: 1 });

  expect(retried).toStrictEqual(first);
  expect(next.reply).toStrictEqual({ balance: 31 });
});

// Each case fails with whatever the client can fail with, or with the receipt of a command that should have been refused.
type Guarantee = Effect.Effect<void, object, LedgerClient>;

const guarantees: Readonly<Record<GuaranteeName, Guarantee>> = {
  closedRefusesMoney,
  closesOnlyWhenEmpty,
  depositReplies,
  neverOpened,
  opensAtZero,
  opensOnce,
  overdraftRefused,
  retriedCommandId,
};

// One test per guarantee, titled with its sentence. Run it against a target with it.layer(target)(title, ledgerConformance),
// So every case shares one build of that target.
const ledgerConformance = (onTarget: Vitest.MethodsNonLive<LedgerClient>): void => {
  for (const [name, guarantee] of Rec.toEntries(guarantees)) {
    // A target is a real system whose views catch up in real time, so the cases run on the live clock.
    onTarget.effect(guaranteeTitles[name], () => TestClock.withLive(guarantee));
  }
};

export { ledgerConformance };

export type { Target };
