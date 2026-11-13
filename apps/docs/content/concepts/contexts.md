---
title: "Contexts"
description: "One package per bounded context, modelled with Alchemy Domain: aggregates, commands, events and views."
status: built
---

A bounded context is one part of the business with its own model and its own words. In hermitstack each context is one package under `contexts/`, written with Alchemy Domain (`@alchemy.run/domain`). You declare its aggregates, commands, events and views once, and the API, the typed client and storage are derived from that declaration.

The ledger, in `contexts/ledger`, is the worked example. This page follows it.

## The parts of a context

| Part                                                                                                                      | Role suffix     | In the ledger                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------- |
| **Aggregate**: one consistency boundary, such as one account. Each instance runs as one actor.                            | `.aggregate.ts` | `Account`                                                            |
| **Command**: a request to change an aggregate, with its input, the events it may record and the rejections it may return. | `.command.ts`   | `OpenAccount`, `DepositMoney`, `WithdrawMoney`, `CloseAccount`       |
| **Event**: a fact the aggregate recorded.                                                                                 | `.event.ts`     | `AccountOpened`, `MoneyDeposited`, `MoneyWithdrawn`, `AccountClosed` |
| **Rejection**: a typed refusal a client can act on.                                                                       | `.rejection.ts` | `AlreadyOpen`, `NotOpen`, `InsufficientFunds`, `BalanceNotZero`      |
| **View**: the read side, a fold over events kept apart from the aggregate's state.                                        | `.view.ts`      | `Balance`                                                            |
| **Model**: the context's aggregates and views, collected.                                                                 | `.model.ts`     | `Ledger`                                                             |
| **Api**: what a client may send and read, listed by name.                                                                 | `.api.ts`       | `LedgerApi`                                                          |

## One folder per use case

Domain code in `contexts/**` and `packages/schedule/**` follows one layout, so everything one use case needs is in one place:

- **One class per file.** An aggregate, a command, an event, a rejection and a policy each get their own file.
- **A folder per use case beside its aggregate.** It holds the command, with its rule exported as `decide<Command>`, the events that command records, its rejections, and the policy that sends the command, if one does.
- **The aggregate's state is in `<aggregate>-state.schema.ts`** beside the aggregate, so every command file can read it. The aggregate file lists the commands and holds how events change the state.
- **Tests mirror the folders.** Steps several stories share go in a `.suite.ts` file under `tests/`, and a suite imports no other suite.

```text
contexts/ledger/src/
  ledger.model.ts             Ledger: aggregates [Account], views [Balance]
  ledger.api.ts               LedgerApi: what a client may call
  account/
    account.aggregate.ts      state, and how each event changes it
    account-state.schema.ts   Unopened | Open { owner, balance } | Closed
    account.id.ts             AccountId, a branded string
    balance.view.ts           the read side
    cents.schema.ts           money is whole cents
    not-open.rejection.ts     shared by deposit, withdraw and close
    open/       open-account.command.ts  account-opened.event.ts   already-open.rejection.ts
    deposit/    deposit-money.command.ts money-deposited.event.ts
    withdraw/   withdraw-money.command.ts money-withdrawn.event.ts insufficient-funds.rejection.ts
    close/      close-account.command.ts account-closed.event.ts   balance-not-zero.rejection.ts
```

Two more examples on `main` show the other shapes a use case takes:

- `contexts/outbound/src/webhook/record-attempt/`: a command that records one of four events, beside the policy that posts the webhook and sends the command with the answer.
- `packages/schedule/src/recurring/tick/`: a command an aggregate schedules to itself, with the `Rearm` policy that schedules the next one.

## A command, traced

A client withdraws 30 cents from an account that holds 50.

1. The client calls `WithdrawMoney` through the typed client. The input schema (`PositiveCents`) refuses zero or a fraction before the account sees it.
2. `decideWithdrawMoney` in `withdraw-money.command.ts` reads the account's state. An open account with enough money records `MoneyWithdrawn { amount: 30, balanceAfter: 20 }`.
3. The aggregate's `evolve` in `account.aggregate.ts` folds that event into the state: the balance becomes 20.
4. The aggregate replies `{ balance: 20 }`, as the command's `reply` schema says.
5. The `Balance` view folds the same event, so a read of the account shows 20 once it has caught up.

The case that goes differently is a withdrawal of 51. At step 2, `decideWithdrawMoney` returns `InsufficientFunds { balance: 50, requested: 51 }` instead of an event. Nothing is recorded, and the client receives that rejection as a typed failure carrying both numbers, so it can say "you have 50, you asked for 51" without a second read.

## Calling a context

From outside, a context is its Api. Every surface (in process, RPC over HTTP, plain JSON, MCP) hands you the same typed client:

```ts
import { Effect } from "effect";

import { AccountId } from "@repo/ledger/account-id";
import { LedgerApi } from "@repo/ledger/api";

const payRent = Effect.gen(function* payRent() {
  const ledger = yield* LedgerApi.Client;
  const account = AccountId.make("acc-1");

  yield* ledger.OpenAccount(account, { owner: "sam" });
  yield* ledger.DepositMoney(account, { amount: 5000 });

  const receipt = yield* ledger.WithdrawMoney(account, { amount: 1200 });

  return receipt.reply.balance;
});
```

`payRent` fails with `InsufficientFunds`, `NotOpen` or `AlreadyOpen` in its error type, and the compiler makes you handle them. [One typed client](/concepts/one-typed-client) shows where the client comes from.

## The rules a context keeps

- **It imports no host.** A context may import `@repo/kernel`, other `lib` packages and Alchemy Domain. Turbo `boundaries` refuses a service, an adapter, infra or an app.
- **It names no vendor.** An outside system is a port: an `ExternalSystem` in a `.external.ts` file. See [Layers and ports](/concepts/layers-and-ports).
- **Its Api lists everything.** `LedgerApi` names each command and view a client may reach, so a command added to the model later stays internal until someone adds it on purpose.
- **Its Domain roles are switched on by folder.** The `aggregate`, `command`, `event`, `projection`, `policy`, `saga` and other Domain roles are allowed under `contexts/**` and `packages/schedule/**`; `oxlint-structure.config.ts` lists them.

## How to check it

```bash
mise exec -- pnpm exec turbo run test --filter=@repo/ledger
```

The ledger has 17 Story tests: given these events, when this command, then these events or this rejection. They run on an in-memory host with no network. [Testing](/guides/testing) explains the form, and [Add a context](/guides/add-a-context) walks through writing your own.
