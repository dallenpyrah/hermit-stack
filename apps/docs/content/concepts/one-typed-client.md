---
title: "One typed client"
description: "One contract serves HTTP, RPC, MCP and the CLI, so every surface calls the same typed API."
status: built
---

A context's Api is the only contract. From one `Api` class, Alchemy Domain derives a typed client and the servers for every surface, and each server calls that same client in process. So validation, middleware and typed rejections behave the same way for a browser, a `curl` call and an agent.

## The whole picture

```text
                 LedgerApi = Api("LedgerApi", { model, commands, views })
                                     │  one RPC group, one client type
      ┌──────────────┬───────────────┼────────────────┬────────────────┐
      ▼              ▼               ▼                ▼                ▼
  RPC client     FoldKit         HTTP + OpenAPI      MCP tools         CLI
  POST /rpc      (planned)       toHttpApi           toMcp             (planned)
                                 └──────── each handler calls ────────┘
                                    the same in-process typed client
```

- **Typed client**: commands are methods (`ledger.WithdrawMoney(...)`), and views are namespaces (`ledger.Balance.get(...)`). It is one type over several protocols: in process, HTTP, and WebSocket.
- **Expose list**: each surface takes the list of calls it publishes. Nothing is exposed by default, so a new command does not become an HTTP endpoint or an agent tool by accident.

## On `main`

`contexts/ledger/src/ledger.api.ts` lists what a client may reach: the four commands and the `Balance` view. `services/api` publishes it three ways:

| Surface                             | File                             | Address                                         |
| ----------------------------------- | -------------------------------- | ----------------------------------------------- |
| Typed client over Effect RPC        | `services/api/src/http.layer.ts` | `POST /rpc`                                     |
| JSON routes and an OpenAPI document | `services/api/src/http.layer.ts` | one route per exposed call, and `/openapi.json` |
| MCP tools for agents                | `services/api/src/mcp.layer.ts`  | `/mcp`                                          |

There is no process entry yet: the layers are built and tested in process and on a port the operating system assigns, not deployed.

## Using the client

Any code that needs the ledger asks for `LedgerApi.Client` and leaves the protocol to whoever provides it:

```ts
import { Effect } from "effect";

import { AccountId } from "@repo/ledger/account-id";
import { LedgerApi } from "@repo/ledger/api";

const balanceAfterDeposit = Effect.gen(function* balanceAfterDeposit() {
  const ledger = yield* LedgerApi.Client;
  const account = AccountId.make("acc-2");

  yield* ledger.OpenAccount(account, { owner: "ada" });

  const receipt = yield* ledger.DepositMoney(account, { amount: 250 });

  // A view catches up after the commit, so a read that must see a write waits for that write's receipt.
  return yield* ledger.Balance.get(account, {
    atLeast: { stream: receipt.stream, version: receipt.version },
  });
});
```

Who provides the client decides how it travels:

- `LedgerApi.layerClientInProcess`, provided with a host: calls in the same process. The spec uses this.
- `LedgerApi.layerClient`, provided with `protocolHttp("<address>/rpc")`: calls a server over HTTP. The spec uses this too, against a server on a free port.

## Deriving a surface

`toHttpApi` turns the Api into plain JSON routes. The expose list names each call, so publishing is always on purpose:

```ts
import { toHttpApi } from "@alchemy.run/domain/Http";

import { LedgerApi } from "@repo/ledger/api";

const ledgerHttp = toHttpApi(LedgerApi, {
  expose: ["OpenAccount", "DepositMoney", "WithdrawMoney", "CloseAccount", "Balance.get"],
});
```

`toMcp` from `@alchemy.run/domain/Ai` takes the same shape and gives one MCP tool per exposed call. Live reads are streams, not tools, so they never appear in MCP.

## The case that goes differently

A rejection keeps its type on every path. Over RPC, `WithdrawMoney` fails with the `InsufficientFunds` value, carrying `balance` and `requested`. Over the JSON routes, the same rejection is an HTTP 422 with the same fields in the body. `services/api/tests/http.layer.test.ts` checks both against one server.

## The catches

- **Outside TypeScript the client is not this one.** A partner in another language gets the OpenAPI document; an MCP client gets JSON Schema tools.
- **The derived HTTP API is for internal tools.** Alchemy advises writing a public or partner API as its own `HttpApi`, with its own response schemas, calling the Api in process. That hand-written public API is planned, for the [mobile](/surfaces/mobile) clients.
- **The CLI and FoldKit clients are planned.** See [CLI](/surfaces/cli) and [Web](/surfaces/web).

## How to check it

```bash
mise exec -- pnpm exec turbo run test --filter=@repo/api --filter=@repo/spec
```

The api tests call the JSON routes, `/openapi.json`, `/rpc` and `/mcp` on a live server. The spec runs the eight ledger guarantees through the typed client, once in process and once over HTTP.
