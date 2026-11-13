import { protocolHttp } from "@alchemy.run/domain";
import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, ConfigProvider, Effect, Layer, Order, Record as Rec, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpRouter,
  HttpServer,
} from "effect/http";

import { AccountId } from "@repo/ledger/account-id";
import { LedgerApi } from "@repo/ledger/api";

import { host } from "#src/host.layer.js";
import { http } from "#src/http.layer.js";

const localTarget = ConfigProvider.layer(ConfigProvider.fromUnknown({ APP_TARGET: "local" }));

// NodeHttpServer.layerTest listens on a port the operating system assigns, and its HttpClient already points there.
const served = HttpRouter.serve(http, { disableListenLog: true, disableLogger: true }).pipe(
  Layer.provide(host),
  Layer.provide(localTarget),
  Layer.provideMerge(layerTest),
);

// The typed client calls the RPC endpoint at the server's own address, the way a separate process would.
const rpcProtocol = Layer.unwrap(
  HttpServer.addressFormattedWith((address) => Effect.succeed(protocolHttp(`${address}/rpc`))),
).pipe(Layer.provide(FetchHttpClient.layer));

const overHttp = LedgerApi.layerClient.pipe(Layer.provide(rpcProtocol), Layer.provideMerge(served));

const unprocessable = 422;

const OpenApiDocument = Schema.Struct({
  info: Schema.Struct({ description: Schema.String }),
  paths: Schema.Record(Schema.String, Schema.Unknown),
});

const refusesOverdraftOverTheWire = Effect.fn("refusesOverdraftOverTheWire")(
  function* refusesOverdraftOverTheWireCase() {
    const ledger = yield* LedgerApi.Client;
    const account = AccountId.make("http-typed");

    yield* ledger.OpenAccount(account, { owner: "sam" });

    const deposited = yield* ledger.DepositMoney(account, { amount: 80 });
    const refused = yield* Effect.flip(ledger.WithdrawMoney(account, { amount: 81 }));

    expect(deposited.reply).toStrictEqual({ balance: 80 });
    expect(refused).toHaveProperty("_tag", "InsufficientFunds");
    expect(refused).toMatchObject({ balance: 80, requested: 81 });
  },
);

const answersJsonWithTheRejection = Effect.fn("answersJsonWithTheRejection")(
  function* answersJsonWithTheRejectionCase() {
    const ledger = yield* LedgerApi.Client;

    yield* ledger.OpenAccount(AccountId.make("http-json"), { owner: "sam" });

    const request = HttpClientRequest.bodyJsonUnsafe(HttpClientRequest.post("/WithdrawMoney"), {
      input: { amount: 1 },
      target: "http-json",
    });

    const response = yield* HttpClient.execute(request);
    const body = yield* response.json;

    expect(response.status).toBe(unprocessable);
    expect(body).toHaveProperty("_tag", "InsufficientFunds");
    expect(body).toMatchObject({ balance: 0, requested: 1 });
  },
);

const publishesOnlyTheExposedCalls = Effect.fn("publishesOnlyTheExposedCalls")(
  function* publishesOnlyTheExposedCallsCase() {
    const response = yield* HttpClient.get("/openapi.json");
    const document = yield* HttpClientResponse.schemaBodyJson(OpenApiDocument)(response);

    expect(document.info.description).toBe("What a client of the ledger may send and read.");
    expect(Arr.sort(Rec.keys(document.paths), Order.String)).toStrictEqual([
      "/Balance/{key}",
      "/CloseAccount",
      "/DepositMoney",
      "/OpenAccount",
      "/WithdrawMoney",
    ]);
  },
);

describe("the HTTP surface", () => {
  it.layer(overHttp)("served on a port the operating system assigns", (onServer) => {
    onServer.effect(
      "refuses an overdraft through the typed client with InsufficientFunds",
      refusesOverdraftOverTheWire,
    );
    onServer.effect("answers a refused JSON command with 422 and the rejection's fields", answersJsonWithTheRejection);
    onServer.effect(
      "publishes in its OpenAPI document only the calls its expose list names",
      publishesOnlyTheExposedCalls,
    );
  });
});
