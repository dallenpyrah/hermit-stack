import { toMcp } from "@alchemy.run/domain/Ai";
import { Layer } from "effect";
import { McpProtocol, McpServer } from "effect/ai";

import { LedgerApi } from "@repo/ledger/api";

const mcpTools = toMcp(LedgerApi, {
  expose: ["OpenAccount", "DepositMoney", "WithdrawMoney", "CloseAccount", "Balance.get"],
});

const mcp = mcpTools.pipe(
  Layer.provide(
    McpServer.layerHttp({
      name: "hermit-stack-ledger",
      path: "/mcp",
      protocols: [McpProtocol.v2025_11_25],
      version: "0.0.0",
    }),
  ),
);

export { mcp, mcpTools };
