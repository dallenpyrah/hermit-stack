---
name: adding-a-context
description: Adds a bounded context to hermit-stack, or an aggregate, command, event, rejection, view or policy to an existing one, written with Alchemy Domain. Use when asked to model a new part of the product, add a domain feature or use case, or add business rules under contexts/. Not for vendor integrations (adding-an-adapter) or screens (adding-a-ui-component).
---

# Adding a context

A context is one package under `contexts/` written with `@alchemy.run/domain`. Copy `contexts/ledger`; do not write the shapes from memory. The full walkthrough is `apps/docs/content/guides/add-a-context.md`.

## Read first

- `contexts/ledger/src/account/` for the layout, and `contexts/ledger/src/account/withdraw/` for a command with a rejection.
- The installed source of `@alchemy.run/domain` in `node_modules` before using an API you have not seen in the ledger. Alchemy 2 is in beta and its API changed recently.

## Layout

One class per file, and one folder per use case beside its aggregate:

```text
contexts/<name>/src/
  <name>.model.ts                 the Model: which aggregates it holds
  <name>.api.ts                   the Api: what a client may call
  <aggregate>/
    <aggregate>.aggregate.ts      lists the commands; how each event changes the state
    <aggregate>-state.schema.ts   the state, so every command file can read it
    <aggregate>.id.ts             a branded id
    <use-case>/
      <verb-noun>.command.ts      the command and its rule, exported as decide<Command>
      <noun-verbed>.event.ts
      <reason>.rejection.ts
```

Tests mirror it: `src/<aggregate>/<use-case>/<verb-noun>.command.ts` is tested by `tests/<aggregate>/<use-case>/<verb-noun>.command.test.ts`.

## Steps

1. Copy `contexts/ledger` to `contexts/<name>/`, delete its `src/` and `tests/`, and set `name` and `exports` in `package.json`. Keep `turbo.json` (the `context` tag) and `tsconfig.json` as they are, then run `mise exec -- pnpm install`.
2. Write the Story test for the first command before the command: given these events, when this command, then these events. A Story test fails when any recorded event, rejection or outside call is left unchecked.
3. Write the event, the command with `decide<Command>`, the state schema, the aggregate, then the model.
4. Write `<name>.api.ts`, naming only what a client may call.
5. Add the context to `services/api`: provide its model Layer in `services/api/src/host.layer.ts`, and add its calls to the expose lists in `services/api/src/http.layer.ts` and `services/api/src/mcp.layer.ts`.
6. Add a line for the new `tsconfig.json` to `ratchets.json` (see Gotchas), then run the checks below.

## Gotchas

- Build a rejection with `new`. Domain types `Rejection.make` as returning the plain fields, which is why the copied `tsconfig.json` turns the `newSchemaClass` diagnostic off.
- A command's `input` lists its own fields. An event's `.fields` include the event's tag, so do not pass them as an input.
- Rename `Story.then` on import (`const { then: recorded } = Story`). A lint rule reads any `.then(` call as a Promise chain.
- A `describe` title is a phrase about behavior, not the name of an imported function. Each case is a named function run with `it.effect`.
- Steps shared by several stories go in a `.suite.ts` under `tests/`, exported `as const satisfies readonly Step[]`. A suite does not import another suite.
- The copied `tsconfig.json` turns two diagnostics off and allows two unstable APIs. The ratchet counts them per file, so `pnpm ratchet` fails with "has no baseline" until `ratchets.json` has those lines for `contexts/<name>/tsconfig.json`. Run `mise exec -- pnpm exec ratchet --print`, copy the new lines, and say why in the commit message.
- A context imports `@repo/kernel` and other `lib` packages only. A vendor is reached through a port: an Effect service the context declares in a `.external.ts` file, which an adapter implements.
- `description` on a command, aggregate or model becomes the OpenAPI text, the MCP tool description and the CLI help. Write it for the person calling it.

## Done

```bash
mise exec -- pnpm exec turbo run typecheck lint test --filter=@repo/<name>
mise exec -- pnpm check
```

Both exit 0. Then break the rule in `decide<Command>` once and watch the Story test fail, so you know the test checks it.
