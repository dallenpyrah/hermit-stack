import { make } from "@alchemy.run/domain/Foldkit";

import { LedgerApi } from "@repo/ledger/api";

const ledger = make(LedgerApi);

type Ledger = typeof LedgerApi.Client.Identifier;

export { type Ledger, ledger };
