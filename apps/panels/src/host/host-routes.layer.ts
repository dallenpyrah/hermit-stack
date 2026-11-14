import { toMcp } from "@alchemy.run/domain/Ai";
import { Array as Arr, Effect, FileSystem, Layer, Path, Result, Schema } from "effect";
import type { Context } from "effect";
import { McpClient, McpProtocol, McpServer } from "effect/ai";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { HttpClient, HttpServerResponse as Response } from "effect/http";

import { LedgerApi } from "@repo/ledger/api";
import { accountPanel } from "@repo/mcp-app/ledger";

const version = "0.0.0";

const panelUri = "ui://hermit-stack/ledger/account";

const hostPage = new globalThis.URL("host.html", import.meta.url);

const ledgerMcp = toMcp(LedgerApi, {
  expose: ["OpenAccount", "DepositMoney", "WithdrawMoney", "CloseAccount", "Balance.get"],
}).pipe(
  Layer.provide(accountPanel),
  Layer.provide(
    McpServer.layerHttp({ name: "hermit-stack-ledger", path: "/mcp", protocols: [McpProtocol.v2025_11_25], version }),
  ),
);

const agent = McpClient.layerHttp({
  name: "hermit-stack-panel-host",
  protocol: McpProtocol.v2025_11_25,
  url: "/mcp",
  version,
});

const ToolCall = Schema.Struct({ arguments: Schema.Record(Schema.String, Schema.Json), name: Schema.String });

const page = Effect.gen(function* page() {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* path.fromFileUrl(hostPage);
  const document = yield* fs.readFileString(file);

  return HttpServerResponse.html(document);
});

const panel = Effect.gen(function* panel() {
  const client = yield* McpClient.McpClient;
  const read = yield* client.readResource({ uri: panelUri });

  return yield* HttpServerResponse.json(read.contents);
});

const tools = Effect.flatMap(McpClient.McpClient, (client) =>
  Effect.flatMap(client.listTools(), (listed) =>
    HttpServerResponse.json(Arr.map(listed, ({ _meta: meta, name }) => ({ meta, name }))),
  ),
);

const callTool = Effect.gen(function* callTool() {
  const call = yield* HttpServerRequest.schemaBodyJson(ToolCall);
  const client = yield* McpClient.McpClient;
  const listed = yield* client.listTools();
  const tool = yield* Effect.fromOption(Arr.findFirst(listed, ({ name }) => name === call.name));
  const result = yield* client.callTool({ arguments: call.arguments, tool });

  return yield* HttpServerResponse.json(result);
});

const failed = (error: Readonly<{ message: string }>): Response.HttpServerResponse =>
  HttpServerResponse.text(error.message, { status: 500 });

type Services = FileSystem.FileSystem | Path.Path | HttpClient.HttpClient;

type Handler<Failure> = Effect.Effect<
  Response.HttpServerResponse,
  Failure,
  McpClient.McpClient | Services | HttpServerRequest.HttpServerRequest
>;

const served =
  (services: Context.Context<Services>) =>
  <Failure extends Readonly<{ message: string }>>(
    handler: Handler<Failure>,
  ): Effect.Effect<Response.HttpServerResponse, never, HttpServerRequest.HttpServerRequest> => {
    const connected = Layer.build(agent).pipe(
      Effect.flatMap((client) => Effect.provideContext(handler, client)),
      Effect.scoped,
      Effect.provideContext(services),
    );

    return Effect.map(Effect.result(connected), Result.getOrElse(failed));
  };

const hostRoutes = HttpRouter.use((router) =>
  Effect.gen(function* hostRoutesLayer() {
    const services = yield* Effect.context<Services>();
    const serve = served(services);

    yield* router.add("GET", "/", serve(page));
    yield* router.add("GET", "/host/panel", serve(panel));
    yield* router.add("GET", "/host/tools", serve(tools));
    yield* router.add("POST", "/host/tools/call", serve(callTool));
  }),
);

const host = Layer.mergeAll(ledgerMcp, hostRoutes);

export { host };
