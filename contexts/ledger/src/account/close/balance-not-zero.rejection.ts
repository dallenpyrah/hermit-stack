import { Rejection } from "@alchemy.run/domain";

import { Cents } from "#src/account/cents.schema.js";

class BalanceNotZero extends Rejection(
  "BalanceNotZero",
  { balance: Cents },
  { description: "An account is closed only once its balance is zero, so no money is stranded in it." },
) {}

export { BalanceNotZero };
