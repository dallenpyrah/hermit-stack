import { Schema } from "effect";

import { Cents } from "#src/account/cents.schema.js";

const Unopened = Schema.TaggedStruct("Unopened", {});

const Open = Schema.TaggedStruct("Open", { balance: Cents, owner: Schema.NonEmptyString });

const Closed = Schema.TaggedStruct("Closed", {});

const AccountState = Schema.Union([Unopened, Open, Closed]);

type AccountState = typeof AccountState.Type;

type OpenState = typeof Open.Type;

export { AccountState, Closed, Open, Unopened };

export type { OpenState };
