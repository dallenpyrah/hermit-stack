---
title: "Add a context"
description: "Create a new bounded context package, from the first aggregate to its Story tests."
status: built
---

A new part of your product starts as a new package under `contexts/`. This guide builds a small `lists` context (shopping lists with one command) and ends with Story tests passing in `pnpm check`. Read [Contexts](/concepts/contexts) first for the words used here.

## 1. Copy the package shell

Copy `contexts/ledger` to `contexts/<name>/` (here the name is `lists`), delete its `src/` and `tests/`, and edit three files:

- `package.json`: set `"name": "@repo/lists"` and point `exports` at the files you will write. Keep the `catalog:` versions and the `scripts` as they are.
- `turbo.json`: keep the `context` tag. It is what stops this package importing a service, an adapter or an app.
- `tsconfig.json`: keep it. It turns off two Effect diagnostics that clash with how Alchemy Domain is typed, each with its reason in a comment.

Run `mise exec -- pnpm install` so the workspace links the new package.

## 2. Write the model

Each file holds one class and has a role suffix, and each command gets a folder for its use case beside the aggregate:

```text
contexts/lists/src/
  lists.model.ts            Lists: aggregates [List]
  lists.api.ts              ListsApi: what a client may call
  list/
    list.aggregate.ts       the commands, and how each event changes the state
    list-state.schema.ts    the state, so every command file can read it
    list.id.ts              ListId, a branded string
    add/
      add-item.command.ts   AddItem, and its rule as decideAddItem
      item-added.event.ts
```

Here is the whole model in one block. In the package each declaration goes in the file named above:

```ts
import { Aggregate, Command, Event, Model } from "@alchemy.run/domain";
import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import { Schema } from "effect";

// A brand keeps a list id from being passed where another kind of id is expected.
const ListId = Schema.String.pipe(Schema.brand("ListId"));

const ItemAdded = Event("ItemAdded", { title: Schema.NonEmptyString });

class AddItem extends Command(
  "AddItem",
  { events: [ItemAdded], input: { title: Schema.NonEmptyString }, target: ListId },
  { description: "Add an item to a list." },
) {}

const ListState = Schema.Struct({ items: Schema.Array(Schema.String) });

// The rule lives in the command's file, beside the events it records.
const decideAddItem = (_state: typeof ListState.Type, command: AddItem): readonly (typeof ItemAdded.Type)[] => [
  ItemAdded.make({ title: command.title }),
];

class List extends Aggregate(
  "List",
  {
    commands: [AddItem],
    decide: { AddItem: decideAddItem },
    evolve: { ItemAdded: (state, event) => ({ items: [...state.items, event.title] }) },
    id: ListId,
    initial: { items: [] },
    state: ListState,
  },
  { description: "One shopping list." },
) {}

class Lists extends Model("Lists", { aggregates: [List] }, { description: "Shopping lists." }) {}

// The Story test: given these events, when this command, then these events.
const story = Story.make(Lists);

// Story.then is renamed because a lint rule reads any .then( call as a Promise chain.
const { then: recorded } = Story;

const groceries = List.ref("groceries");

const recordsTheItem = () =>
  story(
    Story.given(groceries, ItemAdded.make({ title: "milk" })),
    Story.when(groceries, AddItem.make({ title: "eggs" })),
    recorded(groceries, ItemAdded.make({ title: "eggs" })),
  );

describe("adding an item", () => {
  it.effect("records the item after the ones already on the list", recordsTheItem);
});
```

The `description` on each declaration is not decoration: it becomes the OpenAPI text, the MCP tool description and the CLI help.

## 3. Add a rejection

A command that can be refused lists its `rejects` and returns a rejection from `decide` instead of events. See `contexts/ledger/src/account/withdraw/` for a full example: `insufficient-funds.rejection.ts` carries the balance and the amount asked for, and the Story test checks it with `Story.rejected(...)`.

A rejection is built with `new`, because Alchemy Domain types `Rejection.make` as returning the plain fields. That is why the ledger's `tsconfig.json` turns off the `newSchemaClass` diagnostic.

## 4. Write the tests

Tests go in `tests/`, mirroring `src/`: `src/list/add/add-item.command.ts` is tested by `tests/list/add/add-item.command.test.ts`. Steps that several stories share, such as "a list with three items", go in a `.suite.ts` file under `tests/`, exported `as const satisfies readonly Step[]`; a suite imports no other suite. Each case is a named function, run with `it.effect`. A `describe` title is a phrase about behaviour, not the name of the function under test.

A Story test fails if any recorded event, rejection or outside call is left unchecked, so it cannot pass by accident.

## 5. Publish an Api

Write `lists.api.ts` with `Api("ListsApi", { model: Lists, commands: ["AddItem"], views: [], queries: [], streams: [] })`. Only what it names can reach a client. Then add the context to `services/api`: provide its model Layer in `host.layer.ts` and add its calls to the expose lists in `http.layer.ts` and `mcp.layer.ts`. [One typed client](/concepts/one-typed-client) explains the expose lists.

## How to check it

```bash
mise exec -- pnpm exec turbo run test --filter=@repo/lists
mise exec -- pnpm check
```

`lint:structure` fails if a file lacks its role suffix or a folder holds more than 10 code files. `boundaries` fails if the context imports a service or an adapter. The ratchet fails if a test sits outside the `src/` mirror.
