---
title: "Why hermit-stack"
description: "The principles behind the template, and the check that holds each one in place."
status: built
---

hermit-stack is one Effect program. The domain model, the host that runs its actors, the cloud underneath and every vendor are each supplied as a Layer, so a deploy target is a named composition of Layers and moving to another one is a configuration change, not a rewrite.

A principle without a check is a style guide, and style guides drift. So every principle on this page names the check that enforces it, and says whether that check runs in `pnpm check` today.

## What never changes

Five things are imported anywhere and are never swapped:

| Part                             | What it does here                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Effect](https://effect.website) | The runtime, errors, dependency injection and concurrency for every line of TypeScript.           |
| FoldKit                          | The Elm-style frontend: model, message, update, view.                                             |
| Alchemy, with Alchemy Domain     | Infrastructure as Effect code, and the domain model that derives the API, the client and storage. |
| StyleX                           | Styles compiled at build time from typed tokens.                                                  |
| Oxlint                           | The linter, with the rules copied into `tools/rules`.                                             |

Everything else (the actor host, the cloud, email, payments, auth, telemetry backends, feature flag stores) sits behind a port that a fork can swap. [Layers and ports](/concepts/layers-and-ports) shows how.

## The principles

| #   | Principle                                     | What it means                                                                                                     | Enforced by                                                                                      | Runs today                                                                                 |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1   | One program                                   | Frontend, backend, infrastructure and tests are Effect. Errors are typed and dependencies appear in the type.     | `effect-tsgo` with every Effect diagnostic at error; `lint:env` refuses direct environment reads | Yes                                                                                        |
| 2   | Every choice is a Layer                       | A vendor, a host, a cloud or a telemetry backend is one `Layer.provide` line.                                     | Turbo `boundaries` tags: a context cannot import a service, an adapter or an app                 | Yes. A CI job that deletes each target and reruns the check is planned                     |
| 3   | State lives in actors                         | No shared mutable state. A lifecycle is a state machine that runs inside an actor.                                | The effect-machine lint plugin, and `.machine.ts` files allowed only with `.actor.ts`            | The rules are copied; no actor exists yet                                                  |
| 4   | The domain is the source of truth             | The API, the client and storage derive from the model. No hand-written copies of a shape.                         | The conformance suite runs through the derived client; knip fails on dead exports                | Yes                                                                                        |
| 5   | Every file names its role                     | `open-account.command.ts`, `account.aggregate.ts`. At most 10 code files per folder, and `tests/` mirrors `src/`. | `lint:structure` and the ratchet                                                                 | Yes                                                                                        |
| 6   | Every rule is an error, and debt only shrinks | No warnings. Existing exceptions are counted, and a count may only go down.                                       | `ratchet` against `ratchets.json`                                                                | Yes                                                                                        |
| 7   | Observable by construction                    | Telemetry is a required Layer, so a program without it does not typecheck.                                        | The host's type requires the telemetry service                                                   | Planned. See [Telemetry](/guides/telemetry)                                                |
| 8   | Tests are the outside judge                   | The same suite runs against every target, and mutation testing checks that tests can fail.                        | `@repo/conformance` runs in `spec`; the `mutants` gate                                           | The conformance suite runs on the local target. `mutants` is copied but no package runs it |
| 9   | Feedback has a budget                         | Typecheck and lint stay under a fixed time per package.                                                           | A task that times the checkers                                                                   | Planned                                                                                    |

## Why these choices

**The host is a Layer, not a default.** Most Effect stacks assume Cloudflare. Here the cloud is the last decision. The ledger runs in memory today, and [Deploy targets](/guides/deploy-targets) describes how Cloudflare, GCP and AWS join as more entries in one table.

**The bounded context is the unit of the repo.** Each part of the business is one package under `contexts/`, written with Alchemy Domain. Its commands, events and views are declared once and every surface (HTTP, RPC, MCP, the CLI) is derived from them. See [Contexts](/concepts/contexts).

**Rules are copied, not imported.** The lint and type rules live in `tools/rules`, copied from Rika Labs' rules with every change recorded in `tools/rules/UPSTREAM.md`. A fork owns them and receives template changes by merging.

**Deleting is safer than generating.** The template carries every part, each tested together. A fork deletes what it does not want, and knip and the catalog prune what that leaves unused.

## What hermit-stack does not use

These were considered and decided against. A page that suggests otherwise is wrong.

- **Bazel.** pnpm catalogs and Turborepo cover the build. The only edge between TypeScript and a future native app is one generated OpenAPI file.
- **TanStack Query.** FoldKit's Model is the cache. A view is pushed on every commit, and a query keeps its state as `AsyncData` in the Model. See [Live data](/concepts/live-data).
- **FoldCN.** The components in `packages/ui` are written from the tokens, not copied from a registry.
- **An operator console.** Dropped from the surface list.
- **varlock.** Effect `Config` and Alchemy secrets give typed configuration.
- **Tailwind outside `apps/docs`.** Product styles are StyleX. These docs are the only React app in the repo, and they use plain CSS.

## How to check this page

The table above is only true while the checks run. `mise exec -- pnpm check` exits 0 on `main`; if you turn a rule off, the ratchet fails until `ratchets.json` says why.
