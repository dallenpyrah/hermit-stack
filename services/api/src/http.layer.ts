import { toHttpApi } from "@alchemy.run/domain/Http";
import { Effect, Layer } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { HttpRouter } from "effect/http";

import { LedgerApi } from "@repo/ledger/api";

const ledgerHttp = toHttpApi(LedgerApi, {
  expose: ["OpenAccount", "DepositMoney", "WithdrawMoney", "CloseAccount", "Balance.get"],
});

const rpcRoute = HttpRouter.use((router) => Effect.flatMap(LedgerApi, (api) => router.add("POST", "/rpc", api.fetch)));

const jsonRoutes = HttpApiBuilder.layer(ledgerHttp.api, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide(ledgerHttp.layer),
);

const http = Layer.mergeAll(jsonRoutes, rpcRoute);

export { http, ledgerHttp };
