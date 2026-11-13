---
title: "Feature flags"
description: "Typed flags behind a port, read the same way on every host, with a removal date that fails the check when it passes."
status: planned
---

A flag is a typed value declared in its own file and read through one `Flags` service. Where the values are stored is a Layer, like every other choice in hermit-stack. The package will be `packages/flags/**`.

## The design

```text
Sketch of the planned design:

  <name>.flag.ts          name · schema · default · owner · purpose · removeBy
        │ read through
        ▼
  Flags service  ◀── one store Layer:
  (packages/flags)     memory · Config · a flags context (events) · a vendor adapter
        │
        ├─ command handler, policy     may read a flag
        ├─ fold, projection, view      may not (a replay must give the same answer)
        └─ FoldKit                     receives evaluated values in its Model, from a query
```

```text
Sketch: Flag.release and Flags.get are proposed names, not code on main.

export const InstantWithdrawals = Flag.release("ledger.instant-withdrawals", Schema.Boolean, {
  default: false,
  owner: "ledger",
  purpose: "Pay withdrawals out without the settlement delay",
  removeBy: "2027-02-01",
})

const instant = yield* Flags.get(InstantWithdrawals)
```

## Rules that come with it

- **Three kinds, different lifetimes.** A release flag needs a `removeBy` date. An ops flag (a kill switch) has no removal date but needs a `reviewBy` date. What a customer has paid for is not a flag: it is the state of a `Subscription` aggregate (see [Billing](/guides/billing)).
- **Reads never fail.** A store that is down returns the declared default and records that it did.
- **No flag reads where replay happens.** A fold, a projection or a view that read a flag would answer differently when history is replayed. A command handler may read one, because its decision is recorded as an event.
- **The browser gets values, not rules.** The server evaluates flags for the signed-in user and returns them from a query. FoldKit keeps them in its Model, so a view stays a pure function of the Model.
- **Every evaluation is on the trace.** The flag name and value are added to the current span.
- **Past its date is a failing check.** A `flags:check` task joins `pnpm check`.
- **Tests set flags with a Layer.** A memory store goes into the Story's layer, and each flag gets a test per value.

## Where the values live

| Option                                                         | Gains                                                                                                                                                                                                                                                           | Loses                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **A `Config` store first, then a flags context** (recommended) | The first store reads Effect `Config`, so a flag is an environment value. The second is a small context whose events are the changes: it works on every host, keeps a history, reaches the browser through a live view and gets a CLI and MCP surface for free. | The flags context is ours to write and test. |
| A vendor behind an adapter                                     | A dashboard and targeting rules on day one.                                                                                                                                                                                                                     | Flag names and rules live with a vendor.     |
| `Config` only                                                  | Almost nothing to build.                                                                                                                                                                                                                                        | Every change is a deploy.                    |

## What will prove it works

- A Story test per flag value.
- `flags:check` fails on a release flag past its `removeBy` date, naming it.
- Deleting a `.flag.ts` file makes the typechecker list every call site.

## The catches

- A flag doubles the paths through the code it guards. The removal date is the only real control.
- A flags context is read on hot paths, so it needs a cached read, not a call to an actor per evaluation. Not designed yet.
