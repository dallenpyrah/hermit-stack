---
title: "MCP app"
description: "The Api as MCP tools for agents today, and MCP Apps panels that show UI inside an agent host next."
status: planned
---

Agents call hermit-stack through the Model Context Protocol. Half of this is on `main`: the ledger's commands and view are MCP tools at `/mcp`. The other half, MCP Apps, is planned: a tool that shows a small FoldKit panel inside an agent host such as Claude, ChatGPT or VS Code.

## On `main`: MCP tools

`services/api/src/mcp.layer.ts` derives tools from `LedgerApi` with `toMcp` and serves them over HTTP at `/mcp`. The expose list names five calls: the four commands and `Balance.get`. An agent gets a tool only for a call listed there, and live reads are streams, not tools, so they never appear. `services/api/tests/mcp.layer.test.ts` lists the tools and calls one against a live server.

Because the MCP handlers call the same in-process client as HTTP, an agent's `WithdrawMoney` is validated and refused exactly as a browser's is. See [One typed client](/concepts/one-typed-client).

## Planned: MCP Apps panels

```text
Sketch of the planned shape:

 agent host                                           our MCP server
┌───────────────────────────────┐   tools/list       ┌──────────────────────────────────┐
│ the model calls a tool        │◀───────────────────│ tool with _meta.ui.resourceUri   │
│ the host reads the resource   │── resources/read ─▶│ ui://hermit-stack/<panel>, 1 HTML │
│ ┌───────────────────────────┐ │                    └──────────────────────────────────┘
│ │ sandboxed frame           │ │   tools/call
│ │ FoldKit panel             │─┼───────────────────▶
│ └───────────────────────────┘ │
└───────────────────────────────┘
```

- **`packages/mcp-app/**`** will hold both halves: the server half registers the `ui://` resource and annotates chosen tools; the panel half is an Effect service over the MCP Apps client, where a tool call is a FoldKit Command and tool input and results are Subscriptions.
- **Panels live in `apps/panels/**`**, each a small FoldKit app built to one HTML file. The FoldKit roles are already switched on there in `oxlint-structure.config.ts`.
- **Panel tool calls are typed from the Api**, so a renamed command fails the panel's typecheck.
- **The host's theme maps to the StyleX tokens** from `@repo/ui`.

## What will prove it works

- A test lists tools and sees `_meta.ui.resourceUri` on the annotated ones, and reads the resource as `text/html;profile=mcp-app`.
- A Scene test drives a panel's Commands against a fake host connection.

## The catches

- A panel is not live: it sees a change only by calling a tool again.
- Nothing asks a person before a dangerous write. The expose list is the only gate.
- `packages/mcp-app/**` will be a named exception to "only adapters import a vendor SDK", because it imports the MCP Apps SDK.
- Hosts differ in what they render, and none has been tested.
