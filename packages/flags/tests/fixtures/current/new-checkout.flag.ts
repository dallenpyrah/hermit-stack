import { Schema } from "effect";

import { Flag } from "#src/flag/flag.pure.js";

const CheckoutMode = Schema.Literals(["classic", "express"]);

const NewCheckout = Flag.release("checkout.new-flow", CheckoutMode, {
  default: "classic",
  owner: "checkout",
  purpose: "A fixture for flags:check: a release flag due for removal far in the future.",
  removeBy: "2999-12-31",
});

export { NewCheckout };
