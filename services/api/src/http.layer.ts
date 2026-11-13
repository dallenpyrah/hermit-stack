import { toHttpApi } from "@alchemy.run/domain/Http";
import { Effect, Layer } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { HttpRouter } from "effect/http";

import { LedgerApi } from "@repo/ledger/api";

// Nothing reaches plain HTTP unless it is listed here, so a command the Api gains later is not published by accident.
const ledgerHttp = toHttpApi(LedgerApi, {
  expose: ["OpenAccount", "DepositMoney", "WithdrawMoney", "CloseAccount", "Balance.get"],
});

// The typed client speaks Effect RPC. It reaches the same Api the JSON endpoints call in process, so a rejection is the
// Same typed failure on either path.
const rpcRoute = HttpRouter.use((router) => Effect.flatMap(LedgerApi, (api) => router.add("POST", "/rpc", api.fetch)));

const jsonRoutes = HttpApiBuilder.layer(ledgerHttp.api, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide(ledgerHttp.layer),
);

const http = Layer.mergeAll(jsonRoutes, rpcRoute);

export { http, ledgerHttp };
