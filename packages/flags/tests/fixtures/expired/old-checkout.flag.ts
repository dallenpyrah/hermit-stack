import { Schema } from "effect";

import { Flag } from "#src/flag/flag.pure.js";

const OldCheckout = Flag.release("checkout.old-flow", Schema.Boolean, {
  default: false,
  owner: "checkout",
  purpose: "A fixture for flags:check: a release flag whose removal date has passed.",
  removeBy: "2001-01-01",
});

const PaymentsKillSwitch = Flag.ops("payments.kill-switch", Schema.Boolean, {
  default: false,
  owner: "payments",
  purpose: "A fixture for flags:check: an ops flag whose review date has passed.",
  reviewBy: "2002-02-02",
});

export { OldCheckout, PaymentsKillSwitch };
