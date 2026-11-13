import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { Account } from "#src/account/account.aggregate.js";
import { AccountClosed } from "#src/account/close/account-closed.event.js";
import { DepositMoney } from "#src/account/deposit/deposit-money.command.js";
import { MoneyDeposited } from "#src/account/deposit/money-deposited.event.js";
import { NotOpen } from "#src/account/not-open.rejection.js";
import { AccountOpened } from "#src/account/open/account-opened.event.js";
import { Ledger } from "#src/ledger.model.js";

const story = Story.make(Ledger);

type Case = () => ReturnType<typeof story>;

// Story.then is renamed because a lint rule reads any .then( call as a Promise chain.
const { then: recorded } = Story;

const account = Account.ref("acc-1");

const opened = AccountOpened.make({ owner: "sam" });

const addsToTheBalance: Case = () =>
  story(
    Story.given(account, opened, MoneyDeposited.make({ amount: 40, balanceAfter: 40 })),
    Story.when(account, DepositMoney.make({ amount: 25 })),
    recorded(account, MoneyDeposited.make({ amount: 25, balanceAfter: 65 })),
    Story.replied({ balance: 65 }),
  );

const refusedBeforeOpen: Case = () =>
  story(Story.when(account, DepositMoney.make({ amount: 25 })), Story.rejected(new NotOpen()));

const refusedAfterClose: Case = () =>
  story(
    Story.given(account, opened, AccountClosed.make({})),
    Story.when(account, DepositMoney.make({ amount: 25 })),
    Story.rejected(new NotOpen()),
  );

describe("depositing money", () => {
  it.effect("adds the amount to the balance and replies with the new balance", addsToTheBalance);
  it.effect("is refused with NotOpen before the account is opened", refusedBeforeOpen);
  it.effect("is refused with NotOpen after the account is closed", refusedAfterClose);
});
