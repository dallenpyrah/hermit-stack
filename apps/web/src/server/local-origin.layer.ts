import { InMemory } from "@alchemy.run/domain";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";

import { AccountId } from "@repo/ledger/account-id";
import { LedgerApi } from "@repo/ledger/api";
import { Ledger } from "@repo/ledger/model";

const localLedger = Ledger.layer(Layer.empty).pipe(Layer.provide(InMemory));

const ledgerRoutes = HttpRouter.use((router) => Effect.flatMap(LedgerApi, (api) => router.add("*", "/rpc", api.fetch)));

const demoAccount = AccountId.make("demo");

const demoBalance = 12_000;

const seededDemo = Layer.effectDiscard(
  Effect.gen(function* seedDemo() {
    const ledger = yield* LedgerApi.clientInProcess;

    yield* ledger.OpenAccount(demoAccount, { owner: "Dallen" });
    yield* ledger.DepositMoney(demoAccount, { amount: demoBalance });
  }).pipe(Effect.scoped, Effect.orDie),
);

const devOrigin = Layer.merge(ledgerRoutes, seededDemo).pipe(Layer.provide(localLedger));

export { demoAccount, devOrigin, ledgerRoutes, localLedger };
