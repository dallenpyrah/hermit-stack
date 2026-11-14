import { Rejection } from "@alchemy.run/domain";

import { Cents, PositiveCents } from "#src/account/cents.schema.js";

class InsufficientFunds extends Rejection(
  "InsufficientFunds",
  { balance: Cents, requested: PositiveCents },
  { description: "The withdrawal is larger than the balance." },
) {}

export { InsufficientFunds };
