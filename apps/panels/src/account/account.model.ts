import { Schema } from "effect";
import { defineTaggedUnion } from "foldkit/schema";

const Theme = Schema.Literals(["light", "dark"]);

type Theme = typeof Theme.Type;

const AccountStatus = Schema.Literals(["unopened", "open", "closed"]);

type AccountStatus = typeof AccountStatus.Type;

const Account = defineTaggedUnion({
  Loaded: { balance: Schema.Int, owner: Schema.Option(Schema.String), status: AccountStatus },
  Unavailable: { reason: Schema.String },
  Waiting: {},
});

type Account = typeof Account.Type;

const Movement = Schema.Literals(["deposit", "withdraw"]);

type Movement = typeof Movement.Type;

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
