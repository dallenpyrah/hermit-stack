import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { Account } from "#src/account/account.aggregate.js";
import { AccountClosed } from "#src/account/close/account-closed.event.js";
import { BalanceNotZero } from "#src/account/close/balance-not-zero.rejection.js";
import { CloseAccount } from "#src/account/close/close-account.command.js";
import { MoneyDeposited } from "#src/account/deposit/money-deposited.event.js";
import { NotOpen } from "#src/account/not-open.rejection.js";
import { AccountOpened } from "#src/account/open/account-opened.event.js";
import { Ledger } from "#src/ledger.model.js";

const story = Story.make(Ledger);

type Case = () => ReturnType<typeof story>;

const { then: recorded } = Story;

const account = Account.ref("acc-1");

const opened = AccountOpened.make({ owner: "sam" });

const closesWhenEmpty: Case = () =>
  story(
    Story.given(account, opened),
    Story.when(account, CloseAccount.make({})),
    recorded(account, AccountClosed.make({})),
  );

const refusesWithMoney: Case = () =>
  story(
    Story.given(account, opened, MoneyDeposited.make({ amount: 1, balanceAfter: 1 })),
    Story.when(account, CloseAccount.make({})),
    Story.rejected(new BalanceNotZero({ balance: 1 })),
  );

const closesOnce: Case = () =>
  story(
    Story.given(account, opened, AccountClosed.make({})),
    Story.when(account, CloseAccount.make({})),
    Story.rejected(new NotOpen()),
  );

describe("closing an account", () => {
  it.effect("records the closing when the balance is zero", closesWhenEmpty);
  it.effect("is refused with BalanceNotZero while the account holds even one cent", refusesWithMoney);
  it.effect("is refused with NotOpen once the account is closed", closesOnce);
});
