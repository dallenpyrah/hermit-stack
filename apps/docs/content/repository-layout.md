---
title: "Repository layout"
description: "Where each kind of code lives and which way dependencies are allowed to point."
status: built
---

Every package in hermitstack has a kind, and the kind decides two things: which folder it lives in and which other packages it may import. Turbo checks the second on every run.

## The folders

```text
apps/        things people open: docs today; web, cli, desktop and panels planned
contexts/    one package per bounded context, written with Alchemy Domain
adapters/    one package per vendor; the only place its SDK is imported (planned)
packages/    kernel, ui, schedule, conformance; flags and client-data planned
services/    api: where a host, a telemetry backend and the adapters are chosen
infra/       Alchemy stacks (planned)
spec/        behaviour tests through the Api only; never imports a context's src
tools/rules/ the lint and type rules, copied from Rika Labs' rules
```

What is on `main` today:

| Package             | Folder                 | What it holds                                                                                     |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| `@repo/kernel`      | `packages/kernel`      | Shared code every context may use. Today: `spanName`, the naming rule for telemetry spans.        |
| `@repo/ledger`      | `contexts/ledger`      | The worked example: an `Account` aggregate, four commands, a `Balance` view, and the `LedgerApi`. |
| `@repo/outbound`    | `contexts/outbound`    | Public events, notifications and outbound webhooks.                                               |
| `@repo/schedule`    | `packages/schedule`    | The `Recurring` aggregate and its `Rearm` policy, for scheduled work.                             |
| `@repo/ui`          | `packages/ui`          | StyleX tokens, light and dark themes, and six FoldKit components.                                 |
| `@repo/conformance` | `packages/conformance` | Guarantees written once against the typed client, run against any target.                         |
| `@repo/api`         | `services/api`         | The host choice and the HTTP and MCP surfaces.                                                    |
| `@repo/spec`        | `spec`                 | Runs the conformance suite against the local target, in process and over HTTP.                    |
| `@repo/rules`       | `tools/rules`          | Oxlint plugins, the type config and the scripts behind `pnpm check`.                              |
| `@repo/docs`        | `apps/docs`            | This site.                                                                                        |

## Which way dependencies point

Each package's `turbo.json` carries one tag: `kernel`, `lib`, `context`, `adapter`, `service`, `infra`, `app`, `spec` or `tooling`. The root `turbo.json` says which tags may depend on which.

```text
apps      ──▶ contexts, packages
services  ──▶ contexts, adapters, packages
infra     ──▶ services
adapters  ──▶ contexts (the port it implements), packages/kernel
contexts  ──▶ packages/kernel and other lib packages
kernel    ──▶ effect only
nothing   ──▶ an app or spec
```

Two rules carry most of the weight:

- **A context never imports a service, an adapter, infra or an app.** So a context cannot depend on a host, which is what keeps swapping the host cheap.
- **Only an adapter imports a vendor SDK.** A context declares a port; an adapter implements it as a Layer. The `vendor-imports` lint rule holds a list of SDKs that may not be imported anywhere else.

The `spec` package is fenced in further: a lint override stops it importing a context's `src` or model, so it can only reach the ledger through `@repo/ledger/api`.

## Internal packages are source

Packages are named `@repo/<name>` and consumed as TypeScript source. A package's `exports` point at files in `src/`, and there is no build step between packages:

```ts
import { spanName } from "@repo/kernel/span-name";

// Spans are named <context>.<operation> in kebab case, whatever case the code uses.
const name = spanName("ledger", "OpenAccount");
```

Inside a package, its own files are imported through the `#src/*` map in its `package.json`, as `#src/<path>/<name>.<role>.js`.

## How to check it

```bash
mise exec -- pnpm boundaries
```

`turbo boundaries` fails when a package imports a tag it may not, or imports a package it does not list in its `package.json`. It runs first in `pnpm check`.

[Boundaries](/reference/boundaries) lists each tag and its rule. [Conventions](/reference/conventions) covers file names and the `tests/` mirror.
