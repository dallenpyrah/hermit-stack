import { Command } from "@alchemy.run/domain";
import { Function as Fn, Match } from "effect";

import { AccountId } from "#src/account/account.id.js";
import type { AccountState } from "#src/account/account-state.schema.js";
import { Cents, PositiveCents } from "#src/account/cents.schema.js";
import { MoneyDeposited } from "#src/account/deposit/money-deposited.event.js";
import { NotOpen } from "#src/account/not-open.rejection.js";

class DepositMoney extends Command(
  "DepositMoney",
  {
    events: [MoneyDeposited],
    input: { amount: PositiveCents },
    rejects: [NotOpen],
    reply: { balance: Cents },
    target: AccountId,
  },
  { description: "Put money into an open account. The amount is in cents." },
) {}

type Deposit = NotOpen | readonly MoneyDeposited[];

const decideArity = 2;

const notOpen = (): NotOpen => new NotOpen();

const decideDepositMoney: {
  (command: DepositMoney): (state: AccountState) => Deposit;
  (state: AccountState, command: DepositMoney): Deposit;
} = Fn.dual(decideArity, (state: AccountState, command: DepositMoney): Deposit =>
  Match.valueTags(state, {
    Closed: notOpen,
    Open: (open) => [MoneyDeposited.make({ amount: command.amount, balanceAfter: open.balance + command.amount })],
    Unopened: notOpen,
  }),
);

export { decideDepositMoney, DepositMoney };
