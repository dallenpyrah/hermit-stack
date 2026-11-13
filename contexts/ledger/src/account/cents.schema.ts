import { Schema } from "effect";

const noCents = 0;

// Money is whole cents, so no balance ever carries a rounding error.
const Cents = Schema.Int.check(Schema.isGreaterThanOrEqualTo(noCents));

// A deposit or withdrawal of nothing changes nothing, so the schema refuses it before the account decides.
const PositiveCents = Schema.Int.check(Schema.isGreaterThan(noCents));

export { Cents, noCents, PositiveCents };
