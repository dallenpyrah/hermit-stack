import { Event } from "@alchemy.run/domain";

import { Cents, PositiveCents } from "#src/account/cents.schema.js";

// The event records the balance the account worked out, so evolve and every view copy it instead of redoing the sum.
class MoneyDeposited extends Event("MoneyDeposited", { amount: PositiveCents, balanceAfter: Cents }) {}

export { MoneyDeposited };
