import { Schema } from "effect";
import { defineTaggedUnion } from "foldkit/schema";

// The host's light or dark choice, which the panel follows.
const Theme = Schema.Literals(["light", "dark"]);

type Theme = typeof Theme.Type;

const AccountStatus = Schema.Literals(["unopened", "open", "closed"]);

type AccountStatus = typeof AccountStatus.Type;

// What the panel knows of the account: nothing until the agent's Balance.get result arrives, then that result.
const Account = defineTaggedUnion({
  Loaded: { balance: Schema.Int, owner: Schema.Option(Schema.String), status: AccountStatus },
  Unavailable: { reason: Schema.String },
  Waiting: {},
});

type Account = typeof Account.Type;

const Movement = Schema.Literals(["deposit", "withdraw"]);

type Movement = typeof Movement.Type;

// The outcome of the person's last deposit or withdrawal, shown until they try another.
const Notice = defineTaggedUnion({
  Failed: { reason: Schema.String },
  InvalidAmount: {},
  Moved: { amount: Schema.Int, kind: Movement },
  Refused: { reason: Schema.String },
});

type Notice = typeof Notice.Type;

const Model = Schema.Struct({
  account: Account,
  amount: Schema.String,
  key: Schema.Option(Schema.String),
  notice: Schema.Option(Notice),
  saving: Schema.Option(Movement),
  theme: Theme,
});

type Model = typeof Model.Type;

export { Account, AccountStatus, Model, Movement, Notice, Theme };
