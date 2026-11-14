import { Schema } from "effect";

const AccountId = Schema.String.pipe(Schema.brand("AccountId"));

type AccountId = typeof AccountId.Type;

export { AccountId };
