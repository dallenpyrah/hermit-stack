import { ExternalSystem } from "@alchemy.run/domain";
import { Schema } from "effect";

import { PayerNotFound } from "#src/payments/payer-not-found.rejection.js";
import { SubscriptionNotFound } from "#src/payments/subscription-not-found.rejection.js";
import { UnknownPlan } from "#src/payments/unknown-plan.rejection.js";
import { CustomerId } from "#src/subscription/customer.id.js";
import { PlanId } from "#src/subscription/plan.schema.js";

class Payments extends ExternalSystem(
  "Payments",
  {
    cancel: {
      args: { subscription: Schema.String },
      error: SubscriptionNotFound,
    },
    openPortal: {
      args: { payer: Schema.String, returnUrl: Schema.String },
      error: PayerNotFound,
      success: { url: Schema.String },
    },
    startCheckout: {
      args: { cancelUrl: Schema.String, customer: CustomerId, plan: PlanId, successUrl: Schema.String },
      error: UnknownPlan,
      success: { url: Schema.String },
    },
  },
  {
    description:
      "The payment processor: starts a checkout for a plan, opens the page where a payer manages billing, and ends a subscription at the end of its period.",
  },
) {}

export { Payments };
