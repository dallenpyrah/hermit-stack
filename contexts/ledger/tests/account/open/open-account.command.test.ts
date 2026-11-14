import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { Account } from "#src/account/account.aggregate.js";
import { AccountClosed } from "#src/account/close/account-closed.event.js";
import { AccountOpened } from "#src/account/open/account-opened.event.js";
import { AlreadyOpen } from "#src/account/open/already-open.rejection.js";
import { OpenAccount } from "#src/account/open/open-account.command.js";
import { Ledger } from "#src/ledger.model.js";

const story = Story.make(Ledger);

type Case = () => ReturnType<typeof story>;

const { then: recorded } = Story;

const account = Account.ref("acc-1");

const opensForTheOwner: Case = () =>
  story(
    Story.when(account, OpenAccount.make({ owner: "sam" })),
    recorded(account, AccountOpened.make({ owner: "sam" })),
  );

const opensOnce: Case = () =>
  story(
    Story.given(account, AccountOpened.make({ owner: "sam" })),
    Story.when(account, OpenAccount.make({ owner: "ada" })),
    Story.rejected(new AlreadyOpen()),
  );

const neverReopens: Case = () =>
  story(
    Story.given(account, AccountOpened.make({ owner: "sam" }), AccountClosed.make({})),
    Story.when(account, OpenAccount.make({ owner: "sam" })),
    Story.rejected(new AlreadyOpen()),
  );

describe("opening an account", () => {
  it.effect("records who owns it", opensForTheOwner);
  it.effect("is refused with AlreadyOpen when the account is open", opensOnce);
  it.effect("is refused with AlreadyOpen when the account was closed, so an id is never reused", neverReopens);
});
