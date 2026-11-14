import { Schema } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { AccountStatus, Movement, Theme } from "#src/account/account.model.js";

const Message = defineMessageUnion({
  ChangedAmount: { value: Schema.String },
  ChangedTheme: { theme: Theme },
  ClickedMove: { kind: Movement },
  FailedMove: { reason: Schema.String },
  FailedToLoad: { reason: Schema.String },
  GotAccountKey: { key: Schema.String },
  GotBalance: { balance: Schema.Int, owner: Schema.Option(Schema.String), status: AccountStatus },
  Moved: { amount: Schema.Int, balance: Schema.Int, kind: Movement },
  RefusedMove: { reason: Schema.String },
});

type Message = typeof Message.Type;

export { Message };
