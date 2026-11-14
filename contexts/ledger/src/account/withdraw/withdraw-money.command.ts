import { Command } from "@alchemy.run/domain";
import { Function as Fn, Match } from "effect";

import { AccountId } from "#src/account/account.id.js";
import type { AccountState, OpenState } from "#src/account/account-state.schema.js";
import { Cents, PositiveCents } from "#src/account/cents.schema.js";
import { NotOpen } from "#src/account/not-open.rejection.js";
import { InsufficientFunds } from "#src/account/withdraw/insufficient-funds.rejection.js";
import { MoneyWithdrawn } from "#src/account/withdraw/money-withdrawn.event.js";

class WithdrawMoney extends Command(
  "WithdrawMoney",
  {
    events: [MoneyWithdrawn],
    input: { amount: PositiveCents },
    rejects: [NotOpen, InsufficientFunds],
    reply: { balance: Cents },
    target: AccountId,
  },
  { description: "Take money out of an open account, up to its balance. The amount is in cents." },
) {}

type Withdrawal = InsufficientFunds | NotOpen | readonly MoneyWithdrawn[];

const decideArity = 2;

const notOpen = (): NotOpen => new NotOpen();

const withdrawFrom = (open: OpenState, amount: number): Withdrawal => {
  if (amount > open.balance) {
    return new InsufficientFunds({ balance: open.balance, requested: amount });
  }

  return [MoneyWithdrawn.make({ amount, balanceAfter: open.balance - amount })];
};

const decideWithdrawMoney: {
  (command: WithdrawMoney): (state: AccountState) => Withdrawal;
  (state: AccountState, command: WithdrawMoney): Withdrawal;
} = Fn.dual(decideArity, (state: AccountState, command: WithdrawMoney): Withdrawal =>
  Match.valueTags(state, {
    Closed: notOpen,
    Open: (open) => withdrawFrom(open, command.amount),
    Unopened: notOpen,
  }),
);

export { decideWithdrawMoney, WithdrawMoney };
