import { Option } from "effect";
import { make } from "foldkit/subscription";

import type { Model } from "#src/account/account.model.js";
import { Message } from "#src/account/account.message.js";
import type { Ledger } from "#src/account/ledger.api.js";
import { ledger } from "#src/account/ledger.api.js";

const subscriptions = make<Model, Message, Ledger>()(() => ({
  account: ledger.Balance.events({
    cursor: (model: Model) => Option.some(model.account.cursor),
    isEnabled: (model) => model.feed !== "Paused",
    key: (model) => model.accountId,
    onCaughtUp: (cursor): Message => Message.CaughtUp({ cursor }),
    onDefect: (): Message => Message.FailedFeed({ reason: "The live feed failed" }),
    onEntry: ({ envelope, state }): Message =>
      Message.GotAccount({ account: { cursor: envelope.seq, state: Option.fromNullishOr(state) } }),
    onFailure: (): Message => Message.FailedFeed({ reason: "The ledger refused the live read" }),
  }),
}));

export { subscriptions };
