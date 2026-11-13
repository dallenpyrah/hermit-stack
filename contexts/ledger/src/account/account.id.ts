import { Schema } from "effect";

// A brand keeps an account id from being passed where another kind of id is expected, so a command cannot be sent to
// The wrong aggregate.
const AccountId = Schema.String.pipe(Schema.brand("AccountId"));

type AccountId = typeof AccountId.Type;

export { AccountId };
