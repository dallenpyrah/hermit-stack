---
title: "Repository layout"
description: "Where each kind of code lives and which way dependencies are allowed to point."
status: built
---

Every package in hermit-stack has a kind, and the kind decides two things: which folder it lives in and which other packages it may import. Turbo checks the second on every run.

## The folders

```text
apps/        things people open: web, panels, cli and docs; desktop planned
contexts/    one package per bounded context, written with Alchemy Domain
adapters/    one package per vendor; the only place its SDK is imported
packages/    code several contexts or apps share; names no vendor
services/    api: where a host, a telemetry backend and the adapters are chosen
infra/       Alchemy stacks (planned)
spec/        behaviour tests through the Api only; never imports a context's src
tools/rules/ the lint and type rules, copied from Rika Labs' rules
```

What is on `main` today:

| Package             | Folder                 | What it holds                                                                                     |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| `@repo/web`         | `apps/web`             | FoldKit pages rendered on the server from a view's snapshot and kept live over a WebSocket.       |
| `@repo/panels`      | `apps/panels`          | MCP Apps panels for the ledger, each built into one HTML document.                                |
| `@repo/cli`         | `apps/cli`             | An example command line derived from the `LedgerApi`.                                             |
| `@repo/docs`        | `apps/docs`            | This site.                                                                                        |
| `@repo/ledger`      | `contexts/ledger`      | The worked example: an `Account` aggregate, four commands, a `Balance` view, and the `LedgerApi`. |
| `@repo/outbound`    | `contexts/outbound`    | Public events, notifications and outbound webhooks, with the Email, Push and webhook ports.       |
| `@repo/billing`     | `contexts/billing`     | A `Subscription` aggregate, its entitlement view, and the `Payments` port.                        |
| `@repo/kernel`      | `packages/kernel`      | Shared code every context may use. Today: `spanName`, the naming rule for telemetry spans.        |
| `@repo/ui`          | `packages/ui`          | StyleX tokens, light and dark themes, and FoldKit components.                                     |
| `@repo/client-data` | `packages/client-data` | Cache policy over FoldKit's Query.                                                                |
| `@repo/flags`       | `packages/flags`       | Feature flags declared in `<name>.flag.ts` files and read through the `Flags` service.            |
| `@repo/identity`    | `packages/identity`    | Who is signed in: `CurrentUser`, the Session middleware and the contract an auth adapter passes.  |
| `@repo/telemetry`   | `packages/telemetry`   | The telemetry service every host requires, with a recording fake.                                 |
| `@repo/schedule`    | `packages/schedule`    | The `Recurring` aggregate and its `Rearm` policy, for scheduled work.                             |
| `@repo/storage`     | `packages/storage`     | The `Disks` and `Sandboxes` ports, with fakes and contract suites.                                |
| `@repo/mcp-app`     | `packages/mcp-app`     | Panel declarations for an MCP server and the typed client a panel runs in the host's iframe.      |
| `@repo/conformance` | `packages/conformance` | Guarantees written once against the typed client, run against any target.                         |
| `@repo/api`         | `services/api`         | The host choice and the HTTP and MCP surfaces.                                                    |
| `@repo/spec`        | `spec`                 | Runs the conformance suite against the local target and against Cloudflare in workerd.            |
| `@repo/rules`       | `tools/rules`          | Oxlint plugins, the type config and the scripts behind `pnpm check`.                              |

The adapters, one per vendor:

| Port or role        | Adapters                                                  |
| ------------------- | --------------------------------------------------------- |
| Host                | `adapters/cloudflare` (Durable Objects), `adapters/rivet` |
| Telemetry           | `adapters/otlp`, `adapters/axiom`                         |
| Session             | `adapters/better-auth`                                    |
| Payments            | `adapters/stripe`                                         |
| Email               | `adapters/resend`                                         |
| Push                | `adapters/apns`, `adapters/fcm`                           |
| Webhook transport   | `adapters/webhook-http`                                   |
| Disks and sandboxes | `adapters/archil`                                         |

`services/api` chooses only a host today: the local one, Cloudflare or Rivet. Rivet typechecks but has not run. Every other adapter is tested against a local stand-in for its vendor and is not wired into `services/api` yet.

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

const name = spanName("ledger", "OpenAccount");
```

Inside a package, its own files are imported through the `#src/*` map in its `package.json`, as `#src/<path>/<name>.<role>.js`.

## How to check it

```bash
mise exec -- pnpm boundaries
```

`turbo boundaries` fails when a package imports a tag it may not, or imports a package it does not list in its `package.json`. It runs first in `pnpm check`.

[Boundaries](/reference/boundaries) lists each tag and its rule. [Conventions](/reference/conventions) covers file names and the `tests/` mirror.
