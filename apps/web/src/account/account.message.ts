import { Schema } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { AccountSnapshot } from "#src/account/account.model.js";
import { ledger } from "#src/account/ledger.api.js";

const Message = defineMessageUnion({
  CaughtUp: { cursor: Schema.Int },
  ChangedAmount: { value: Schema.String },
  ClickedDeposit: {},
  ClickedReconnect: {},
  ClickedWithdraw: {},
  FailedFeed: { reason: Schema.String },
  GotAccount: { account: AccountSnapshot },
  GotLedgerResult: { result: ledger.Message },
});

type Message = typeof Message.Type;

export { Message };
