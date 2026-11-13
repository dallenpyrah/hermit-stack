import { Command } from "@alchemy.run/domain";
import { Match } from "effect";

import { AccountId } from "#src/account/account.id.js";
import type { AccountState, OpenState } from "#src/account/account-state.schema.js";
import { noCents } from "#src/account/cents.schema.js";
import { AccountClosed } from "#src/account/close/account-closed.event.js";
import { BalanceNotZero } from "#src/account/close/balance-not-zero.rejection.js";
import { NotOpen } from "#src/account/not-open.rejection.js";

class CloseAccount extends Command(
  "CloseAccount",
  {
    events: [AccountClosed],
    rejects: [NotOpen, BalanceNotZero],
    target: AccountId,
  },
  { description: "Close an open account whose balance is zero." },
) {}

type Closing = BalanceNotZero | NotOpen | readonly AccountClosed[];

const notOpen = (): NotOpen => new NotOpen();

const closeEmpty = (open: OpenState): Closing => {
  if (open.balance !== noCents) {
    return new BalanceNotZero({ balance: open.balance });
  }

  return [AccountClosed.make({})];
};

// Closing takes no input, so the state alone decides it.
const decideCloseAccount = (state: AccountState): Closing =>
  Match.valueTags(state, { Closed: notOpen, Open: closeEmpty, Unopened: notOpen });

export { CloseAccount, decideCloseAccount };
