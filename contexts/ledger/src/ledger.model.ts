import { Model } from "@alchemy.run/domain";

import { Account } from "#src/account/account.aggregate.js";
import { Balance } from "#src/account/balance.view.js";

class Ledger extends Model(
  "Ledger",
  { aggregates: [Account], views: [Balance] },
  { description: "Bank accounts: opening, deposits, withdrawals and closing." },
) {}

export { Ledger };
