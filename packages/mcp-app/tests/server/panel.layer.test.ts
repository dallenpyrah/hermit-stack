import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";
import { McpClient } from "effect/ai";

import { LedgerApi } from "@repo/ledger/api";

import { panel, panels } from "#src/server/panel.layer.js";
import { ledgerAgent } from "#tests/ledger/account-panel.fake";

const document = "<!doctype html><html><body><p>A test panel</p></body></html>";

const testPanel = panels([
  panel({
    api: LedgerApi,
    csp: { connectDomains: [], resourceDomains: ["https://fonts.example.com"] },
    description: "An account's balance, with deposit and withdraw.",
    html: Effect.succeed(document),
    name: "Test account",
    prefersBorder: true,
    renders: ["Balance.get", "DepositMoney"],
    uri: "ui://test/account",
  }),
]);

const linkedMeta = { ui: { resourceUri: "ui://test/account" }, "ui/resourceUri": "ui://test/account" };

const listsThePanel = Effect.fn("listsThePanel")(function* listsThePanelCase() {
  const client = yield* McpClient.McpClient;
  const resources = yield* client.listResources();

  expect(Arr.map(resources, ({ mimeType, name, uri }) => ({ mimeType, name, uri }))).toStrictEqual([
    { mimeType: "text/html;profile=mcp-app", name: "Test account", uri: "ui://test/account" },
  ]);
});

const readsTheDocument = Effect.fn("readsTheDocument")(function* readsTheDocumentCase() {
  const client = yield* McpClient.McpClient;
  const read = yield* client.readResource({ uri: "ui://test/account" });

  // An empty origin list is left out, so the host keeps its default of no network access.
  expect(read.contents).toStrictEqual([
    {
      _meta: { ui: { csp: { resourceDomains: ["https://fonts.example.com"] }, prefersBorder: true } },
      mimeType: "text/html;profile=mcp-app",
      text: document,
      uri: "ui://test/account",
    },
  ]);
});

const linksOnlyTheRenderedTools = Effect.fn("linksOnlyTheRenderedTools")(function* linksOnlyTheRenderedToolsCase() {
  const client = yield* McpClient.McpClient;
  const tools = yield* client.listTools();

  const linked = Arr.getSomes(
    Arr.map(tools, ({ _meta: meta, name }) =>
      Option.map(Option.fromNullishOr(meta), (found) => ({ meta: found, name })),
    ),
  );

  expect(Arr.map(tools, ({ name }) => name)).toStrictEqual([
    "LedgerApi_OpenAccount_send",
    "LedgerApi_DepositMoney_send",
    "LedgerApi_WithdrawMoney_send",
    "LedgerApi_CloseAccount_send",
    "LedgerApi_Balance_get",
  ]);

  expect(linked).toStrictEqual([
    { meta: linkedMeta, name: "LedgerApi_DepositMoney_send" },
    { meta: linkedMeta, name: "LedgerApi_Balance_get" },
  ]);
});

describe("a panel added to the ledger's MCP server", () => {
  it.layer(ledgerAgent(testPanel))("served over HTTP to an MCP client", (connected) => {
    connected.effect("lists the panel as an MCP Apps resource", listsThePanel);
    connected.effect("reads the panel's document with its content policy", readsTheDocument);
    connected.effect("points each tool it renders at the panel and leaves the others alone", linksOnlyTheRenderedTools);
  });
});
