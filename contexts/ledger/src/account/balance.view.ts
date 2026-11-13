import { View } from "@alchemy.run/domain";
import { Schema } from "effect";

import { Account } from "#src/account/account.aggregate.js";
import { Cents, noCents } from "#src/account/cents.schema.js";

const BalanceState = Schema.Struct({
  balance: Cents,
  owner: Schema.optionalKey(Schema.NonEmptyString),
  status: Schema.Literals(["unopened", "open", "closed"]),
});

type BalanceState = typeof BalanceState.Type;

const afterMovement = (state: BalanceState, event: { readonly balanceAfter: number }): BalanceState => ({
  ...state,
  balance: event.balanceAfter,
});

// The read side of an account: what a client may see, kept apart from the aggregate's state so either can change alone.
class Balance extends View(
  "Balance",
  {
    evolve: {
      AccountClosed: (state) => ({ ...state, status: "closed" as const }),
      AccountOpened: (state, event) => ({ ...state, owner: event.owner, status: "open" as const }),
      MoneyDeposited: afterMovement,
      MoneyWithdrawn: afterMovement,
    },
    from: [Account],
    initial: { balance: noCents, status: "unopened" },
    key: Account,
    state: BalanceState,
  },
  { description: "An account's owner, balance and whether it is open." },
) {}

export { Balance };
