import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, ConfigProvider, Effect, Layer, Order } from "effect";
import type { NoSuchElementError } from "effect/Cause";
import { McpClient, McpProtocol } from "effect/ai";
import type { McpSchema } from "effect/ai";
import { HttpRouter } from "effect/http";

import { host } from "#src/host.layer.js";
import { mcp } from "#src/mcp.layer.js";

const localTarget = ConfigProvider.layer(ConfigProvider.fromUnknown({ APP_TARGET: "local" }));

const served = HttpRouter.serve(mcp, { disableListenLog: true, disableLogger: true }).pipe(
  Layer.provide(host),
  Layer.provide(localTarget),
  Layer.provideMerge(layerTest),
);

const agent = McpClient.layerHttp({
  name: "hermit-stack-test-agent",
  protocol: McpProtocol.v2025_11_25,
  url: "/mcp",
  version: "0.0.0",
}).pipe(Layer.provideMerge(served));

const toolNamed = (tools: readonly McpSchema.Tool[], name: string): Effect.Effect<McpSchema.Tool, NoSuchElementError> =>
  Effect.fromOption(Arr.findFirst(tools, (tool) => tool.name === name));

const listsTheExposedCalls = Effect.fn("listsTheExposedCalls")(function* listsTheExposedCallsCase() {
  const client = yield* McpClient.McpClient;
  const tools = yield* client.listTools();

  expect(
    Arr.sort(
      Arr.map(tools, (tool) => tool.name),
      Order.String,
    ),
  ).toStrictEqual([
    "LedgerApi_Balance_get",
    "LedgerApi_CloseAccount_send",
    "LedgerApi_DepositMoney_send",
    "LedgerApi_OpenAccount_send",
    "LedgerApi_WithdrawMoney_send",
  ]);
});

const opensThroughATool = Effect.fn("opensThroughATool")(function* opensThroughAToolCase() {
  const client = yield* McpClient.McpClient;
  const tools = yield* client.listTools();
  const open = yield* toolNamed(tools, "LedgerApi_OpenAccount_send");
  const balance = yield* toolNamed(tools, "LedgerApi_Balance_get");
  const sent = yield* client.callTool({ arguments: { input: { owner: "ada" }, target: "mcp-1" }, tool: open });

  const read = yield* client.callTool({ arguments: { atLeast: sent.structuredContent, key: "mcp-1" }, tool: balance });

  expect(sent.isError).not.toBe(true);
  expect(read.structuredContent).toStrictEqual({ value: { balance: 0, owner: "ada", status: "open" } });
});

describe("the MCP surface", () => {
  it.layer(agent)("served over HTTP to an MCP client", (connected) => {
    connected.effect("lists one tool for each call its expose list names", listsTheExposedCalls);
    connected.effect("opens an account through one tool and reads it back through another", opensThroughATool);
  });
});
