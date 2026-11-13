import { Command } from "@alchemy.run/domain";
import { Function as Fn, Match, Schema } from "effect";

import { AccountId } from "#src/account/account.id.js";
import type { AccountState } from "#src/account/account-state.schema.js";
import { AccountOpened } from "#src/account/open/account-opened.event.js";
import { AlreadyOpen } from "#src/account/open/already-open.rejection.js";

class OpenAccount extends Command(
  "OpenAccount",
  {
    events: [AccountOpened],
    input: { owner: Schema.NonEmptyString },
    rejects: [AlreadyOpen],
    target: AccountId,
  },
  { description: "Open an account for an owner. It starts with a balance of zero." },
) {}

type Opening = AlreadyOpen | readonly AccountOpened[];

const decideArity = 2;

const alreadyOpen = (): AlreadyOpen => new AlreadyOpen();

// An id that has ever been opened stays taken, closed or not, so a closed account's history is never reused.
const decideOpenAccount: {
  (command: OpenAccount): (state: AccountState) => Opening;
  (state: AccountState, command: OpenAccount): Opening;
} = Fn.dual(decideArity, (state: AccountState, command: OpenAccount): Opening =>
  Match.valueTags(state, {
    Closed: alreadyOpen,
    Open: alreadyOpen,
    Unopened: () => [AccountOpened.make({ owner: command.owner })],
  }),
);

export { decideOpenAccount, OpenAccount };
