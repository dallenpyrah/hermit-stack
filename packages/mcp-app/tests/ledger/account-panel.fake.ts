import { InMemory } from "@alchemy.run/domain";
import { toMcp } from "@alchemy.run/domain/Ai";
import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { Effect, FileSystem, Layer, Path, String as Str } from "effect";
import type { Cause } from "effect";
import { McpClient, McpProtocol, McpServer } from "effect/ai";
import type { McpClientError } from "effect/ai";
import { HttpRouter } from "effect/http";
import type { HttpServerError } from "effect/http";

import { LedgerApi } from "@repo/ledger/api";
import { Ledger } from "@repo/ledger/model";

// Stands in for the panel's built document, so the server can be tested without building apps/panels first.
const accountDocument = "<!doctype html><html><body><p>An account</p></body></html>";

// The file system the account panel reads its document from: it holds the one built file, and records nothing else.
const builtPanels = Layer.merge(
  FileSystem.layerNoop({
    readFileString: (file) =>
      Effect.succeed(accountDocument).pipe(
        Effect.filterOrElse(
          () => Str.endsWith("/apps/panels/dist/account.html")(file),
          () => Effect.die(`The account panel read ${file}, not the built document.`),
        ),
      ),
  }),
  Path.layer,
);

// The ledger's MCP server as services/api builds it, with the given panels Layer as the one added line, served over
// HTTP to an MCP client: what an agent host connects to.
type AgentError = Cause.IllegalArgumentError | McpClientError.McpClientError | HttpServerError.ServeError;

const ledger = Ledger.layer(Layer.empty).pipe(Layer.provide(InMemory));

const ledgerAgent = (
  panels: Layer.Layer<McpServer.McpServer, never, McpServer.McpServer | FileSystem.FileSystem | Path.Path>,
): Layer.Layer<McpClient.McpClient, AgentError> => {
  const mcp = toMcp(LedgerApi, {
    expose: ["OpenAccount", "DepositMoney", "WithdrawMoney", "CloseAccount", "Balance.get"],
  }).pipe(
    Layer.provide(panels),
    Layer.provide(
      McpServer.layerHttp({
        name: "hermit-stack-ledger",
        path: "/mcp",
        protocols: [McpProtocol.v2025_11_25],
        version: "0.0.0",
      }),
    ),
  );

  const served = HttpRouter.serve(mcp, { disableListenLog: true, disableLogger: true }).pipe(
    Layer.provide(ledger),
    Layer.provide(builtPanels),
    Layer.provideMerge(layerTest),
  );

  return McpClient.layerHttp({
    name: "hermit-stack-test-host",
    protocol: McpProtocol.v2025_11_25,
    url: "/mcp",
    version: "0.0.0",
  }).pipe(Layer.provide(served));
};

export { accountDocument, ledgerAgent };

export type { AgentError };
