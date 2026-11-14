import { Api } from "@alchemy.run/domain";

import { Ledger } from "#src/ledger.model.js";

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
