import { Api } from "@alchemy.run/domain";

import { Ledger } from "#src/ledger.model.js";

// Everything a client may reach is listed by name, so a command added to the model later stays internal until it is
// Added here on purpose.
class LedgerApi extends Api(
  "LedgerApi",
  {
    commands: ["OpenAccount", "DepositMoney", "WithdrawMoney", "CloseAccount"],
    model: Ledger,
    queries: [],
    streams: [],
    views: ["Balance"],
  },
  { description: "What a client of the ledger may send and read." },
) {}

export { LedgerApi };
