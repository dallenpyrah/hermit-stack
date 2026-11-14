import { Schema } from "effect";

const noCents = 0;

const Cents = Schema.Int.check(Schema.isGreaterThanOrEqualTo(noCents));

const PositiveCents = Schema.Int.check(Schema.isGreaterThan(noCents));

export { Cents, noCents, PositiveCents };
