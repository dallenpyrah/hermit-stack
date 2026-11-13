import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { Account } from "#src/account/account.aggregate.js";
import { Balance } from "#src/account/balance.view.js";
import { AccountClosed } from "#src/account/close/account-closed.event.js";
import { MoneyDeposited } from "#src/account/deposit/money-deposited.event.js";
import { AccountOpened } from "#src/account/open/account-opened.event.js";
import { MoneyWithdrawn } from "#src/account/withdraw/money-withdrawn.event.js";
import { Ledger } from "#src/ledger.model.js";

const story = Story.make(Ledger);

type Case = () => ReturnType<typeof story>;

const account = Account.ref("acc-1");

const opened = AccountOpened.make({ owner: "sam" });

const showsOpenAtZero: Case = () =>
  story(Story.given(account, opened), Story.view(Balance, account, { balance: 0, owner: "sam", status: "open" }));

const followsEachMovement: Case = () =>
  story(
    Story.given(
      account,
      opened,
      MoneyDeposited.make({ amount: 90, balanceAfter: 90 }),
      MoneyWithdrawn.make({ amount: 25, balanceAfter: 65 }),
    ),
    Story.view(Balance, account, { balance: 65, owner: "sam", status: "open" }),
  );

const showsClosed: Case = () =>
  story(
    Story.given(account, opened, AccountClosed.make({})),
    Story.view(Balance, account, { balance: 0, owner: "sam", status: "closed" }),
  );

describe("an account's balance", () => {
  it.effect("shows a newly opened account as open, with its owner and zero", showsOpenAtZero);
  it.effect("shows the balance after the latest deposit or withdrawal", followsEachMovement);
  it.effect("shows a closed account as closed", showsClosed);
});
