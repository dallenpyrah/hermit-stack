---
title: "Testing"
description: "Story tests for contexts, Scene tests for views, conformance suites through the typed client, and mutation testing."
status: built
---

hermitstack sorts tests by what they are allowed to know, and puts the weight on the ones that know least. A test that only knows the Api survives a rewrite of the code behind it; a test that knows the events survives a new handler but not a new model. Every test runs with `@effect/vitest` on Vitest, with no network and no cloud.

## The levels

| Level       | Allowed to know                             | Runs against                        | Where                                         | On `main`                                           |
| ----------- | ------------------------------------------- | ----------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| Story       | A context's commands and events             | An in-memory host                   | `contexts/*/tests`, `packages/schedule/tests` | Yes: 17 in the ledger, 5 in schedule, 3 in outbound |
| Scene       | A FoldKit view's model and messages         | No browser                          | `packages/ui/tests`                           | Yes: 24 in the design system                        |
| Conformance | The typed client only                       | Any target that provides the client | `packages/conformance`, run by `spec`         | Yes: 8 guarantees, run twice                        |
| Surface     | HTTP, OpenAPI, RPC and MCP on a live server | A port the operating system assigns | `services/api/tests`                          | Yes                                                 |
| Mutation    | Whether the tests above can fail            | `mutants` with a baseline           | Per package                                   | Copied, not run yet                                 |
| Wire spec   | A URL; cases are data files                 | Anything that speaks the protocol   | Planned                                       | No                                                  |

## Rules every test follows

- Import from `@effect/vitest`: `import { describe, expect, it } from "@effect/vitest"`.
- Each case is a named function, run with `it.effect("...", () => Effect.sync(fn))` or an `Effect.fn`.
- A `describe` title is a phrase about behaviour, not the name of an imported function.
- Never call `Effect.run*` in a test, and never bind a fixed port (the `no-fixed-port` lint rule).
- Tests live in `tests/`, mirroring `src/`. The ratchet counts any test outside the mirror.
- A fake for an outside system lives in `tests/`, at the path and name of the `src/` file it stands in for, and a package may export it for other packages' tests.

## Story tests

A Story says: given these events, when this command, then these events, or this rejection. It fails if any recorded event, rejection or outside call is left unchecked. The ledger's `tests/account/withdraw/withdraw-money.command.test.ts` has four:

```text
Excerpt from contexts/ledger, which imports the context's own source:

const takesFromTheBalance = () =>
  story(
    Story.given(account, AccountOpened.make({ owner: "sam" }), MoneyDeposited.make({ amount: 50, balanceAfter: 50 })),
    Story.when(account, WithdrawMoney.make({ amount: 30 })),
    recorded(account, MoneyWithdrawn.make({ amount: 30, balanceAfter: 20 })),
    Story.replied({ balance: 20 }),
  );
```

[Add a context](/guides/add-a-context) has a complete Story you can typecheck. Schedule's Stories run on Effect's test clock, so "a late tick runs once" is tested without waiting.

## Scene tests

A Scene renders a FoldKit program without a browser and checks what a person would see. This is how `packages/ui` tests its components:

```ts
import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { expect as sceneExpect, given, scene, text } from "foldkit/scene";
import type { Return } from "foldkit/update";

import { badge } from "@repo/ui/badge";

type Model = Readonly<{ count: number }>;

const update = (model: Model): Return<Model, never> => ({ model });

const view = (model: Model, html: HtmlBuilder<never>): Html =>
  html.div([], [badge({ content: [`${model.count} new`] }, html)]);

const showsTheCount = (): void => {
  scene({ update, view }, given({ count: 3 }), sceneExpect(text("3 new")).toExist());
};

const takesNoClicks = (): void => {
  scene({ update, view }, given({ count: 1 }), sceneExpect(text("1 new")).not.toHaveHandler("click"));
};

describe("a badge with a count", () => {
  it.effect("shows the count", () => Effect.sync(showsTheCount));
  it.effect("takes no clicks", () => Effect.sync(takesNoClicks));
});
```

## Conformance suites

A conformance suite is a list of guarantees, each one sentence a client can check through the Api alone, and each the title of its test. `@repo/conformance` holds eight for the ledger in `packages/conformance/src/guarantee-titles.pure.ts`, such as "a command retried with the same command id returns the first receipt and moves the money once".

The suite takes no target of its own. Whoever runs it provides the typed client, so the same cases judge any implementation:

```ts
import { InMemory } from "@alchemy.run/domain";
import { it } from "@effect/vitest";
import { Layer } from "effect";

import { ledgerConformance } from "@repo/conformance/ledger";
import { LedgerApi } from "@repo/ledger/api";
import { Ledger } from "@repo/ledger/model";

const inMemory = LedgerApi.layerClientInProcess.pipe(Layer.provide(Layer.provide(Ledger.layer(Layer.empty), InMemory)));

it.layer(inMemory)("the ledger on an in-memory host", ledgerConformance);
```

`spec/tests/local-target.suite.test.ts` runs it twice: in process through `services/api`'s host, and over HTTP against a server on a free port. A lint override stops `spec` importing a context's `src` or model, so it can only use the Api. When a new host arrives, it joins as one more `it.layer(...)` line; if the host is a true swap, the suite passes unchanged.

Each case opens an account no other case has used, because a deployed stage keeps its accounts between runs.

## Mutation testing

A mutation tool changes the code in one small way and reruns the tests; if they still pass, no test checks that behaviour. The `mutants` gate is copied into `tools/rules` (`tools/rules/docs/mutants.md`): it reads the outcomes of `mutant-cafe`, which chooses mutants from Effect types (swallow a typed error, turn an error into a defect, fail a Layer), and fails on any survivor that is not in a baseline with a reason. No package runs it yet. The plan is to start every package at an empty baseline and keep it there.

## How to check it

```bash
mise exec -- pnpm exec turbo run test
```

Runs every package's tests. `pnpm check` runs them too, after typecheck and lint.
