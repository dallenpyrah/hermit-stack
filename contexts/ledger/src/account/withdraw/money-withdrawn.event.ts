import { Event } from "@alchemy.run/domain";

import { Cents, PositiveCents } from "#src/account/cents.schema.js";

class MoneyWithdrawn extends Event("MoneyWithdrawn", { amount: PositiveCents, balanceAfter: Cents }) {}

export { MoneyWithdrawn };
