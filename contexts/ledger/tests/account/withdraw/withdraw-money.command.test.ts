import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { Account } from "#src/account/account.aggregate.js";
import { MoneyDeposited } from "#src/account/deposit/money-deposited.event.js";
import { NotOpen } from "#src/account/not-open.rejection.js";
import { AccountOpened } from "#src/account/open/account-opened.event.js";
import { InsufficientFunds } from "#src/account/withdraw/insufficient-funds.rejection.js";
import { MoneyWithdrawn } from "#src/account/withdraw/money-withdrawn.event.js";
import { WithdrawMoney } from "#src/account/withdraw/withdraw-money.command.js";
import { Ledger } from "#src/ledger.model.js";

const story = Story.make(Ledger);

type Case = () => ReturnType<typeof story>;

const { then: recorded } = Story;

const account = Account.ref("acc-1");

const opened = AccountOpened.make({ owner: "sam" });

const holdingFifty = Story.given(account, opened, MoneyDeposited.make({ amount: 50, balanceAfter: 50 }));

const takesFromTheBalance: Case = () =>
  story(
    holdingFifty,
    Story.when(account, WithdrawMoney.make({ amount: 30 })),
    recorded(account, MoneyWithdrawn.make({ amount: 30, balanceAfter: 20 })),
    Story.replied({ balance: 20 }),
  );

const emptiesTheAccount: Case = () =>
  story(
    holdingFifty,
    Story.when(account, WithdrawMoney.make({ amount: 50 })),
    recorded(account, MoneyWithdrawn.make({ amount: 50, balanceAfter: 0 })),
    Story.replied({ balance: 0 }),
  );

const refusesOverdraft: Case = () =>
  story(
    holdingFifty,
    Story.when(account, WithdrawMoney.make({ amount: 51 })),
    Story.rejected(new InsufficientFunds({ balance: 50, requested: 51 })),
  );

const refusedBeforeOpen: Case = () =>
  story(Story.when(account, WithdrawMoney.make({ amount: 1 })), Story.rejected(new NotOpen()));

describe("withdrawing money", () => {
  it.effect("takes the amount from the balance and replies with what is left", takesFromTheBalance);
  it.effect("may take the whole balance", emptiesTheAccount);
  it.effect("is refused with InsufficientFunds, carrying the balance and the amount, one cent over", refusesOverdraft);
  it.effect("is refused with NotOpen before the account is opened", refusedBeforeOpen);
});
