import { protocolHttp } from "@alchemy.run/domain";
import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient, HttpRouter, HttpServer } from "effect/http";

import { host } from "@repo/api/host";
import { http } from "@repo/api/http";
import { ledgerConformance } from "@repo/conformance/ledger";
import { LedgerApi } from "@repo/ledger/api";

// The spec reaches the ledger only through the client derived from its Api, so it holds for any implementation behind
// That Api. What changes between these runs is how the client reaches the local target.
const localConfig = ConfigProvider.fromUnknown({ APP_TARGET: "local" });

const localHost = Layer.provide(host, ConfigProvider.layer(localConfig));

const inProcess = LedgerApi.layerClientInProcess.pipe(Layer.provide(localHost));

const served = HttpRouter.serve(http, { disableListenLog: true, disableLogger: true }).pipe(
  Layer.provide(localHost),
  Layer.provideMerge(layerTest),
);

const rpcProtocol = Layer.unwrap(
  HttpServer.addressFormattedWith((address) => Effect.succeed(protocolHttp(`${address}/rpc`))),
).pipe(Layer.provide(FetchHttpClient.layer));

const overHttp = LedgerApi.layerClient.pipe(Layer.provide(rpcProtocol), Layer.provide(served));

it.layer(inProcess)("the local target, called in process", ledgerConformance);

it.layer(overHttp)("the local target, called over HTTP on a port the operating system assigns", ledgerConformance);
