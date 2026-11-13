---
title: "Boundaries"
description: "The Turbo tags each package carries and the dependency directions they enforce."
status: built
---

Each package's `turbo.json` carries one tag. The root `turbo.json` says, per tag, which other tags it may not depend on, or which may not depend on it. `turbo boundaries` checks every import against those rules, and it is the first thing `pnpm check` runs.

## The tags

| Tag       | Rule in the root `turbo.json`                                              | Packages on `main`                                |
| --------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| `kernel`  | May not depend on `lib`, `context`, `adapter`, `service`, `infra` or `app` | `@repo/kernel`                                    |
| `lib`     | May not depend on `adapter`, `service`, `infra` or `app`                   | `@repo/ui`, `@repo/schedule`, `@repo/conformance` |
| `context` | May not depend on `adapter`, `service`, `infra` or `app`                   | `@repo/ledger`, `@repo/outbound`                  |
| `adapter` | May not depend on `service`, `infra` or `app`                              | none yet                                          |
| `service` | May not depend on `infra` or `app`                                         | `@repo/api`                                       |
| `infra`   | No rule of its own yet; nothing below it may depend on it                  | none yet                                          |
| `app`     | Nothing may depend on it                                                   | `@repo/docs`                                      |
| `spec`    | Nothing may depend on it, including another spec                           | `@repo/spec`                                      |
| `tooling` | No rule of its own; may not depend on an app                               | `@repo/rules`                                     |

Read as directions, that is:

```text
apps      ──▶ contexts, packages
services  ──▶ contexts, adapters, packages
infra     ──▶ services
adapters  ──▶ contexts (the port it implements), packages/kernel
contexts  ──▶ packages/kernel and other lib packages
kernel    ──▶ effect only
```

## What each rule protects

- **A context cannot reach a host.** Contexts may not import a service, where the host is chosen, or an adapter, where vendors live. So the domain never depends on how or where it runs.
- **Only adapters see vendors.** A service composes adapters; a context only declares the port. The `vendor-imports` lint rule adds the second half: a listed vendor SDK may not be imported outside `adapters/**`.
- **Nothing depends on an app.** Apps are leaves. These docs import workspace packages only to typecheck their code examples, and nothing may import the docs.
- **Nothing depends on the spec.** The spec is a judge, not a library. A lint override in `oxlint.config.ts` fences it further: it may not import a context's `src` or `@repo/*/model`, so it reaches a context only through its Api.

## Undeclared imports

`turbo boundaries` also fails when a package imports another workspace package it does not list in its own `package.json`. A dependency that works only because pnpm hoisted it is caught here.

## How to check it

```bash
mise exec -- pnpm boundaries
```

The pre-commit hook runs it too, on every commit.
