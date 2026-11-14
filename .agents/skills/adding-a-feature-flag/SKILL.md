---
name: adding-a-feature-flag
description: Declares, reads, tests and removes a feature flag in hermit-stack with @repo/flags. Use when asked to gate a feature, roll something out to a percentage of users, add a kill switch, or when flags:check fails on an expired flag. Not for what a customer has paid for, which is aggregate state, or for configuration, which is Effect Config.
---

# Adding a feature flag

A flag is a typed value declared in its own file and read through the `Flags` service from `@repo/flags/flags`. A read never fails: when the store fails or holds a value the Schema rejects, the read returns the flag's default, logs a warning and records why on the current span.

## Read first

- `packages/flags/tests/flags/flags.service.test.ts`: declaring, reading and testing, in one file.
- `packages/flags/src/flag/flag.pure.ts`: the two constructors and their fields.

## Declare

Put the flag in `<name>.flag.ts`, in the package that owns the behavior it gates. `flags:check` finds flags by that file ending.

```ts
import { Flag } from "@repo/flags/flag";
import { Schema } from "effect";

const InstantWithdrawals = Flag.release("ledger.instant-withdrawals", Schema.Boolean, {
  default: false,
  owner: "ledger",
  purpose: "Pay withdrawals out without the settlement delay.",
  removeBy: "2027-02-01",
});

export { InstantWithdrawals };
```

- `Flag.release` is for a rollout and takes `removeBy`. `Flag.ops` is for a kill switch or a degraded mode and takes `reviewBy`. Both dates are `YYYY-MM-DD`.
- The name is `<context>.<kebab-name>`.
- The default is the value the product is safe with when the store is down. For a release flag that is the old behavior.
- A flag with more than two states is a `Schema.Literals([...])`, not two booleans.

## Read

`yield* Flags.get(InstantWithdrawals)` for one answer for everyone, or `Flags.get(InstantWithdrawals, userId)` so a percentage rule gives the same subject the same answer every time. Raising the percentage keeps everyone who was already included.

Read a flag in a command handler or a policy. Do not read one in a fold, a projection or a view: a replay must give the same state. A FoldKit screen receives the evaluated value in its Model from a query.

## Test

Provide the store with the fake, and test both sides of the flag:

```ts
import { FlagStoreFake } from "@repo/flags/flag-store-fake";
import { Flags } from "@repo/flags/flags";
import { Layer } from "effect";

const instantOn = Layer.provide(Flags.layer, FlagStoreFake({ "ledger.instant-withdrawals": [{ value: true }] }));
```

## Run

`Flags.layerConfig` reads each flag from Effect `Config` under `FLAG_<NAME>`, the name upper-cased with `.` and `-` turned into `_`: `FLAG_LEDGER_INSTANT_WITHDRAWALS=true`. Another store is another Layer that provides `FlagStore` from `@repo/flags/flag-store`.

## Remove

When a release flag has served its purpose, delete the `.flag.ts` file, the losing branch at every read, and the tests of that branch. `mise exec -- pnpm check` fails once the date in `removeBy` or `reviewBy` has passed. Moving the date is for an ops flag you reviewed, not for a release flag you forgot.

## Done

```bash
mise exec -- pnpm exec turbo run typecheck lint test --filter=@repo/<package>
mise exec -- pnpm exec turbo run flags:check
```

Both exit 0, and a test covers each value the flag can hold.
