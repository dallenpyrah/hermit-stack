---
title: "Conventions"
description: "File roles and suffixes, tests that mirror src, the catalog and the other rules every package follows."
status: built
---

Every convention on this page is enforced by a check, and each section names it. When a check fails, its message says what to change.

## Every file names its role

Name every source file `<kebab-name>.<role>.ts`, such as `span-name.pure.ts` or `open-account.command.ts`. The role says what the file may hold and what it may import: a `.pure` file imports only other pure files and definitions, a `.layer` builds a Layer, and nothing imports a `.cli` file or a test.

The full list of roles is in `tools/rules/src/oxlint/structure/roles.pure.ts`. Some roles are switched on only where `oxlint-structure.config.ts` allows them:

- **Alchemy Domain roles** (`aggregate`, `event`, `external`, `id`, `policy`, `projection`, `rejection`, `saga`, `stream` and the rest) under `contexts/**` and `packages/schedule/**`.
- **FoldKit roles** (`model`, `message`, `update`, `subscription`, `command`) under `apps/web/**`, `apps/panels/**`, `packages/ui/**` and `packages/client-data/**`.
- **The `build` role** in `apps/docs`, for code that Next.js and Fumadocs run only while they build the site.

Next.js's own files (`page.tsx`, `layout.tsx`, `route.ts` and the rest) keep the names Next.js needs.

A folder holds at most 10 code files directly, and a file at most 500 lines, Markdown included.

**Checked by** `lint:structure` over the whole repo, and the ratchet, which counts folders over 10 files and files over 500 lines.

## Domain code: one class per file, one folder per use case

In `contexts/**` and `packages/schedule/**`:

- **One class per file.** Copy `contexts/ledger/src/account/`.
- **A folder per use case, beside its aggregate.** `contexts/ledger/src/account/deposit/` holds the command, the events that command records, its rejections, and the policy that sends the command, if one does.
- **The rule lives with the command.** The command file exports it as `decide<Command>`, such as `decideWithdrawMoney`. The aggregate file lists the commands and holds how events change the state.
- **State is its own schema.** The aggregate's state is in `<aggregate>-state.schema.ts` beside the aggregate, so every command file can read it.
- **A command's `input` lists its own fields.** An event's `.fields` include the event's tag, so do not reuse them as an input.
- **An aggregate or model file may import 20 modules**, because it lists one class per file. Every other file keeps the cap of 10.

Three examples on `main` show the shapes a use case takes: `contexts/ledger/src/account/withdraw/` (a command that rejects), `contexts/outbound/src/webhook/record-attempt/` (a command with four events, beside the policy that posts the webhook), and `packages/schedule/src/recurring/tick/` (a command an aggregate schedules to itself).

**Checked by** `lint:structure` and the role rules in `tools/rules`.

## Tests mirror `src`

A test lives in its package's `tests/` folder, at the same path and name as the `src/` file it tests, with `.test` added: `src/telemetry/span-name.pure.ts` is tested by `tests/telemetry/span-name.pure.test.ts`, and `contexts/ledger/tests/account/deposit/deposit-money.command.test.ts` tests the deposit command.

Steps that several stories share go in a `.suite.ts` file under `tests/`, exported `as const satisfies readonly Step[]`. A suite imports no other suite.

A test imports `describe`, `expect` and `it` from `@effect/vitest`. Each case is a named function run with `it.effect`, a test never calls `Effect.run*`, and a `describe` title is a phrase about behaviour:

```ts
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { spanName } from "@repo/kernel/span-name";

const writesKebabCase = (): void => {
  expect(spanName("ledger", "OpenAccount")).toBe("ledger.open-account");
};

describe("a span name", () => {
  it.effect("writes a PascalCase operation in kebab case", () => Effect.sync(writesKebabCase));
});
```

Inside its own package a test imports the file it tests as `#src/telemetry/span-name.pure.js`. This example imports the kernel's public export instead, because the code blocks on this site are typechecked from `apps/docs`.

**Checked by** `lint:structure`, the `testing` lint rules, and the ratchet, which counts tests outside the mirror.

## Fakes live in `tests/`

A fake stands in for an outside system in tests. It lives in `tests/`, at the path and name of the `src/` file it replaces: `contexts/outbound/src/notification/email.external.ts` has `contexts/outbound/tests/notification/email.fake.ts`. A package may export its fake for another package's contract tests, as outbound does with `@repo/outbound/email-fake`.

An in-memory implementation that a running target uses is not a fake. It is product code, a `.layer.ts` file in `src/`.

## Imports

- Import your package's own source as `#src/<path>/<name>.<role>.js`. Relative imports also end in `.js`.
- Import another package through its `exports`, such as `@repo/kernel/span-name`, never through its `src` folder. There are no barrel files.
- `apps/docs` is the exception to the `.js` ending: Next.js and Node run its TypeScript directly, so it imports `.ts` and `.tsx` files by their real names.

**Checked by** `typecheck`, `boundaries` and the `barrel-imports` rule.

## Functions with two or more parameters can be piped

An exported function with two or more parameters also has a pipeable form, built with `Function.dual`, with the arity in a named constant:

```ts
import { Function as Fn, pipe } from "effect";

const withTaxArity = 2;

// Prices are whole cents, so the tax is rounded once, at the end.
const withTax: {
  (rate: number): (cents: number) => number;
  (cents: number, rate: number): number;
} = Fn.dual(withTaxArity, (cents: number, rate: number): number => Math.round(cents * (1 + rate)));

const direct = withTax(1000, 0.08);

const piped = pipe(1000, withTax(0.08));
```

**Checked by** `typecheck`: the `missingPipeableSignature` Effect diagnostic is an error.

## No inline suppressions

Do not write `oxlint-disable`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`. A rule is turned off in one place only, the off table in `tools/rules/src/oxlint/base.config.ts`, with a reason beside it. If a rule is wrong for your code, change the code; if the rule is wrong, change it there for everyone.

Comments start with a capital letter and say why the code is the way it is, not what it does.

**Checked by** the pre-commit hook and the ratchet, which counts inline suppressions and rules turned off.

## Configuration goes through Effect `Config`

Code never reads `process.env` by a name the root `.env.schema` does not declare, or by a computed name. Configuration is read through Effect `Config`, as `services/api/src/host.layer.ts` reads `APP_TARGET`.

**Checked by** `lint:env`.

## Every version lives in the catalog

A `package.json` never names a version. Add the version to the `catalog` in `pnpm-workspace.yaml` and write `catalog:`:

```json
{
  "dependencies": {
    "effect": "catalog:"
  }
}
```

- **Strict catalog.** `catalogMode: strict` refuses a version written anywhere else.
- **Strict peers.** Peers are not installed for you. A package with tests lists `vite`, `vitest` and `@effect/vitest` in its own `devDependencies`.
- **A day's wait.** `minimumReleaseAge` refuses a release less than a day old. Pick the newest version that passes, and do not weaken the policy.
- **Nothing unused.** knip fails on an unused file, export, dependency or catalog entry. Each exception sits in the root `knip.config.ts` with its reason.

**Checked by** `pnpm install`, `sherif` and `knip`.

## Starting a package

Copy `packages/kernel` for a new package: its `package.json` scripts, `tsconfig.json`, `vitest.config.ts` and `turbo.json`, and set the tag. For a context, copy `contexts/ledger` instead; [Add a context](/guides/add-a-context) walks through it.
