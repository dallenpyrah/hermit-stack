import { Rejection } from "@alchemy.run/domain";

import { Cents, PositiveCents } from "#src/account/cents.schema.js";

// It carries the balance and the request, so a client can say "you have 50, you asked for 80" without a second read.
class InsufficientFunds extends Rejection(
  "InsufficientFunds",
  { balance: Cents, requested: PositiveCents },
  { description: "The withdrawal is larger than the balance." },
) {}

export { InsufficientFunds };
