import { Aggregate } from "@alchemy.run/domain";
import { Match } from "effect";

import { AccountId } from "#src/account/account.id.js";
import { AccountState, Closed, Open, Unopened } from "#src/account/account-state.schema.js";
import { noCents } from "#src/account/cents.schema.js";
import { CloseAccount, decideCloseAccount } from "#src/account/close/close-account.command.js";
import { decideDepositMoney, DepositMoney } from "#src/account/deposit/deposit-money.command.js";
import { decideOpenAccount, OpenAccount } from "#src/account/open/open-account.command.js";
import { decideWithdrawMoney, WithdrawMoney } from "#src/account/withdraw/withdraw-money.command.js";

const withBalance = (state: AccountState, balance: number): AccountState =>
  Match.valueTags(state, {
    Closed: (current) => current,
    Open: (open) => Open.make({ ...open, balance }),
    Unopened: (current) => current,
  });

const balanceOf = (state: AccountState): { readonly balance: number } =>
  Match.valueTags(state, {
    Closed: () => ({ balance: noCents }),
    Open: (open) => ({ balance: open.balance }),
    Unopened: () => ({ balance: noCents }),
  });

class Account extends Aggregate(
  "Account",
  {
    commands: [OpenAccount, DepositMoney, WithdrawMoney, CloseAccount],
    decide: {
      CloseAccount: decideCloseAccount,
      DepositMoney: decideDepositMoney,
      OpenAccount: decideOpenAccount,
      WithdrawMoney: decideWithdrawMoney,
    },
    evolve: {
      AccountClosed: () => Closed.make({}),
      AccountOpened: (_state, event) => Open.make({ balance: noCents, owner: event.owner }),
      MoneyDeposited: (state, event) => withBalance(state, event.balanceAfter),
      MoneyWithdrawn: (state, event) => withBalance(state, event.balanceAfter),
    },
    id: AccountId,
    initial: Unopened.make({}),
    reply: {
      DepositMoney: balanceOf,
      WithdrawMoney: balanceOf,
    },
    state: AccountState,
  },
  { description: "One bank account. Its balance never goes below zero, and it closes only when empty." },
) {}

export { Account };
