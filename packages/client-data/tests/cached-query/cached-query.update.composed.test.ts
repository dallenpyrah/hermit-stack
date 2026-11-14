import { InMemory } from "@alchemy.run/domain";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Layer, Schema } from "effect";
import { AsyncData } from "foldkit";
import { TestClock } from "effect/testing";

import { AccountId } from "@repo/ledger/account-id";
import { LedgerApi } from "@repo/ledger/api";
import { Ledger } from "@repo/ledger/model";

import { define } from "#src/cached-query/cached-query.update.js";

const balances = define({
  args: { accountId: AccountId },
  data: Schema.Finite,
  error: Schema.String,
  execute: ({ accountId }) =>
    Effect.gen(function* readBalance() {
      const ledger = yield* LedgerApi.Client;
      const state = yield* ledger.Balance.get(accountId).pipe(Effect.mapError(() => "The ledger could not be read."));

      return yield* Effect.fromNullishOr(state).pipe(
        Effect.mapBoth({ onFailure: () => "NoSuchAccount", onSuccess: ({ balance }) => balance }),
      );
    }),
  maxEntries: 10,
  name: "LedgerBalance",
  staleTime: "30 seconds",
  toKey: ({ accountId }) => accountId,
});

const inProcess = LedgerApi.layerClientInProcess.pipe(
  Layer.provide(Ledger.layer(Layer.empty)),
  Layer.provide(InMemory),
);

const repliedAt = 5000;

const accountId = AccountId.make("client-data-sam");

const depositedSixtyFive = Effect.gen(function* depositSixtyFive() {
  const ledger = yield* LedgerApi.Client;

  yield* ledger.OpenAccount(accountId, { owner: "sam" });

  const receipt = yield* ledger.DepositMoney(accountId, { amount: 65 });

  yield* ledger.Balance.get(accountId, { atLeast: { stream: receipt.stream, version: receipt.version } });
}).pipe(TestClock.withLive);

const readsTheLedger = Effect.gen(function* readsTheLedgerCase() {
  yield* depositedSixtyFive;
  yield* TestClock.setTime(repliedAt);

  const started = balances.update(balances.init(), balances.Message.Requested({ args: { accountId } }));
  const fetch = yield* Effect.fromOption(Arr.head(started.commands ?? []));
  const reply = yield* fetch.effect;
  const replied = balances.update(started.model, reply);

  expect(balances.read(replied.model, { accountId })).toStrictEqual(AsyncData.Success({ data: 65 }));
  expect(AsyncData.getData(balances.query.read(replied.model.query, { accountId }))).toMatchObject({
    value: { fetchedAt: repliedAt },
  });
});

describe("a cached query over the ledger's typed client", () => {
  it.layer(inProcess)("called in process", (test) => {
    test.effect("fetches the balance and stamps the reply with the clock", () => readsTheLedger);
  });
});
