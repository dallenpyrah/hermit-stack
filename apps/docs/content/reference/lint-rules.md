---
title: "Lint rules"
description: "The Oxlint and type rules copied into tools/rules, and how to read a finding."
status: built
---

The lint and type rules live in `tools/rules` as the `@repo/rules` package. They were copied from Rika Labs' rules, not imported: a fork owns them, edits them in place and receives template changes by merging. `tools/rules/UPSTREAM.md` records the commit they came from and every change since.

Every rule is an error. There are no warnings.

## The layers

| Layer              | What it checks                                                                                                                                                                                                  | Where                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Effect diagnostics | 145 Effect-specific type diagnostics, such as a floating Effect, `Effect.provide` away from an entry point, a missing pipeable signature or an unstable API leaking from an export                              | `tools/rules/tsconfig.base.json`, run by `effect-tsgo` in `typecheck` |
| Oxlint base        | Correctness, imports, Promises, Vitest and the rest, with type-aware rules                                                                                                                                      | `tools/rules/src/oxlint/base.config.ts`                               |
| Taste plugin       | Effect style: named `Effect.fn`s whose name matches the binding, no `pipe` on an `Effect.fn`, no type predicates, no unbounded concurrency, no vague names, `Error`-suffixed tagged errors, no grab-bag modules | `tools/rules/src/oxlint/taste/`                                       |
| Testing plugin     | `no-fixed-port`: a test may not bind a fixed port                                                                                                                                                               | `tools/rules/src/oxlint/testing/`                                     |
| Structure plugin   | `file-role`, `role-imports`, `role-exports`, `vendor-imports` and `barrel-imports`                                                                                                                              | `tools/rules/src/oxlint/structure/`                                   |
| Anti-slop          | Vendored rules against common generated-code patterns, kept byte for byte                                                                                                                                       | `tools/rules/src/oxlint/anti-slop/`                                   |
| Next.js            | The `next` and `nextStructure` configs for these docs: React rules, client and build file globs                                                                                                                 | `tools/rules/src/oxlint/next.config.ts`                               |

`tools/rules/docs/adr/` explains why the rules are shaped this way, one decision per file: one shared rules package, every rule at error, the vendored anti-slop rules, Effect diagnostics in the type checker, every file naming its role, and lifecycles as effect-machines.

## How the repo wires them

- `oxlint.config.ts` at the root extends the base config and adds overrides: the docs app's `next()` config, `specThroughApiOnly` for the spec, `entryPoints` for `*.main.ts` files, and `domainLists`, which lets an aggregate or model file import 20 modules.
- `oxlint-structure.config.ts` runs the structure rules over every file and switches the Domain and FoldKit roles on per folder.
- Each package's `lint` script runs `effect-tsgo --tsrs-lint oxlint --type-aware` on its `src` and `tests`.

## Reading a finding

A finding names the rule, the file and the line, and its message follows one grammar: what is wrong, why, and the fix. Fix the code; do not suppress the rule. If the rule is wrong for everyone, change it in `tools/rules` and record the change in `tools/rules/UPSTREAM.md`.

## Turning a rule off

A rule is turned off in one place only, the off table in `tools/rules/src/oxlint/base.config.ts`, with a reason beside it. An override scope in `oxlint.config.ts` is the other way to narrow a rule, and each one carries a comment saying why. The ratchet counts both, so turning a rule off fails `pnpm check` until `ratchets.json` is raised in the same commit, with the reason.

Inline suppressions (`oxlint-disable`, `@ts-ignore`, `@ts-expect-error`) are refused by the pre-commit hook and counted by the ratchet; the count on `main` is zero.

## How to check it

```bash
mise exec -- pnpm exec turbo run lint lint:structure
```

`pnpm exec turbo run test --filter=@repo/rules` runs the rules' own tests: deterministic fixtures for each rule, the vendored anti-slop tests and the CLI tests.
