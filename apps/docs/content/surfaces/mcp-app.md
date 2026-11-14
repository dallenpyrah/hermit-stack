---
title: "MCP app"
description: "The Api as MCP tools for agents, and an MCP Apps panel that shows a FoldKit interface for a tool's result inside an agent host."
status: built
---

Agents call hermit-stack through the Model Context Protocol. The ledger's commands and view are MCP tools at `/mcp`, and `Balance.get` is linked to an MCP Apps panel: an agent host that supports MCP Apps shows the account's balance with deposit and withdraw buttons, built with the same FoldKit and StyleX design system as the web app.

It is built against the MCP Apps specification revision 2026-01-26 (`specification/2026-01-26/apps.mdx` in `modelcontextprotocol/ext-apps`). No real agent host has rendered the panel yet; a local host page stands in for one.

## The whole

```text
 agent host                                           hermit-stack MCP server (services/api)
┌───────────────────────────────┐   tools/list       ┌───────────────────────────────────────────┐
│ the model calls Balance.get   │◀───────────────────│ toMcp(LedgerApi) tools; Balance.get has   │
│                               │                    │ _meta.ui.resourceUri (panels Layer)       │
│ the host reads the resource   │── resources/read ─▶│ ui://hermit-stack/ledger/account          │
│                               │                    │ text/html;profile=mcp-app, one document   │
│ ┌───────────────────────────┐ │                    └───────────────────────────────────────────┘
│ │ sandboxed iframe          │ │  postMessage JSON-RPC: ui/initialize, tool-input, tool-result,
│ │ apps/panels account panel │◀┼─ host-context-changed; tools/call from the panel, run on the server
│ └───────────────────────────┘ │
└───────────────────────────────┘
```

- **Server half**, `packages/mcp-app/src/server/panel.layer.ts`: `panel(...)` declares a panel (its `ui://` uri, the calls it renders, its document as an Effect, its content policy and border preference). `panels([...])` is a Layer over `McpServer`: provide it to the tools `toMcp` derives and give it the transport. It adds each panel's resource and wraps `addTool`, so a tool the panel renders is registered with `_meta.ui.resourceUri` (and the deprecated flat `ui/resourceUri` key the official SDK also writes). The tools stay exactly what `toMcp` made of the Api.
- **The ledger's panel**, `packages/mcp-app/src/ledger/account-panel.layer.ts`: renders `Balance.get` and reads its document from `apps/panels/dist/account.html` on every `resources/read`, so a rebuilt panel is served without a restart.
- **Panel half**, `packages/mcp-app/src/panel/`: `PanelHost` is an Effect service for code inside the iframe. `panelHost(appInfo)` performs the handshake over any `HostChannel`; `browserPanelHost(appInfo)` is that over `postMessage` to the framing window, with the panel's size reported as it changes. A test gives it a fake `HostChannel`, so the protocol runs with no browser.
- **The panel**, `apps/panels`: one FoldKit app, built by Vite into one self-contained `dist/account.html`.

## One case: the agent asks for a balance

1. The model calls `LedgerApi_Balance_get` with `{ key: "acct-1" }`. The host sees `_meta.ui.resourceUri` on that tool and reads `ui://hermit-stack/ledger/account`.
2. The panel starts in the host's iframe. `panelHost` sends `ui/initialize` with its app info and protocol version, decodes the host's result (host info and context, including the theme) and announces `ui/notifications/initialized`. A host that refuses or never answers within ten seconds fails the Layer with `HostHandshakeError`, and the panel shows its crash view.
3. The host sends `ui/notifications/tool-input` and `ui/notifications/tool-result`. `toolInput(LedgerApi, "Balance.get")` and `toolResult(LedgerApi, "Balance.get")` decode them with the schemas Domain derives for that call, so the panel receives `{ value: { balance, owner, status } }` typed.
4. The person types 2.50 and presses Enter. The panel's `Move` command calls `host.call(LedgerApi, "DepositMoney", { input: { amount: 250 }, target: "acct-1" })`. The params are checked against the tool's schema before they leave the panel, sent as tools/call, and the result is decoded as the command's reply.

A withdrawal larger than the balance goes differently at step 4: the ledger answers `isError: true` with the encoded rejection, and `host.call` fails with the typed `InsufficientFunds` (with its balance and requested amount), so the panel says "The balance is $7.50, so $9.00 cannot be withdrawn." A host that cannot reach the server fails the call with `ToolCallError` instead.

## Adding it to the server

`services/api/src/mcp.layer.ts` adds one line between the tools and the transport, with `accountPanel` imported from `@repo/mcp-app/ledger` and `@repo/mcp-app` added to its dependencies:

```text
const mcp = mcpTools.pipe(
  Layer.provide(accountPanel),
  Layer.provide(McpServer.layerHttp({ ... })),
);
```

The panel reads its document through `FileSystem` and `Path`, which `NodeHttpServer`'s layers provide. Build `apps/panels` before serving it.

## Why it holds up

- **One surface.** Tool names come from Domain's own naming (`operationsOf`, `callName`, `toolName`), and `PanelHost.call` is typed by the same Api, so renaming a command fails the panel's typecheck and a panel can never link a tool `toMcp` did not register. Declaring a call no tool exists for, or providing the panels Layer after the tools registered, dies at startup.
- **No vendor SDK.** The protocol messages are Effect Schemas in `packages/mcp-app/src/protocol/message.schema.ts`; the specification makes the SDK optional. The host's style variables and fonts are left out on purpose: a panel paints with `@repo/ui` tokens and follows only the host's light or dark choice.
- **The host is untrusted.** Every message is decoded against the specification and anything else is dropped. In the browser only messages from the framing window are read.
- **Params on the wire are plain.** FoldKit's command, model and update files cannot import a context's `.id` files, so `call` takes the params with brands removed (`Wire<...>`), and the tool's schema restores and checks the brands before anything is sent.
- **One document.** An MCP Apps host serves the document alone, so `apps/panels/src/build/single-file.plugin.ts` puts each page's script and stylesheet inside it. StyleX appends its rules to the page's own `account.css`, which is why the page links one.

## Seeing it without an agent host

`mise exec -- pnpm --filter @repo/panels run host` starts `apps/panels/src/host/host.main.ts` with Bun: the ledger's MCP server with the account panel on an in-memory ledger, and a page that plays the host. It logs the address. The page reads the panel through `resources/read`, frames it in an iframe sandboxed to `allow-scripts allow-forms` under the specification's default content policy, answers the handshake, sends the opening `Balance.get` call, forwards tools/call to the server through an MCP client, and toggles the theme with `host-context-changed`. `?account=` picks the account and `?theme=dark` the starting theme. It is a single iframe, not the double-iframe sandbox proxy the specification recommends for web hosts.

## What proves it

- `packages/mcp-app/tests/server/panel.layer.test.ts`: an MCP client connected over HTTP to the ledger's server with a panel added lists the resource, reads its document and content policy, and sees only the rendered tools linked; the ledger's own panel serves the built document with only the `_meta` keys it sets.
- `packages/mcp-app/tests/panel/panel-host.layer.test.ts`: the panel client against a fake host that forwards tools/call to the real ledger MCP server covers the handshake, the opening call decoded, a deposit, the typed `InsufficientFunds`, a theme change, and a refused handshake.
- `apps/panels/tests/account/account.view.test.ts`: Scene tests for each of the panel's screens.

## The catches

- No real agent host has rendered the panel. Hosts differ in what they render and in how they size an inline frame.
- A panel is not live: it sees a change only by calling a tool again.
- Nothing asks a person before a dangerous write. The expose list is the only gate.
- The document is read from the repo's build output, so the server must run from source on Node or Bun. A bundled or edge target needs the document shipped beside it.
