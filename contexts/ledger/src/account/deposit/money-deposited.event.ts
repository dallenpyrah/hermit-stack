import { Event } from "@alchemy.run/domain";

import { Cents, PositiveCents } from "#src/account/cents.schema.js";

class MoneyDeposited extends Event("MoneyDeposited", { amount: PositiveCents, balanceAfter: Cents }) {}

export { MoneyDeposited };
