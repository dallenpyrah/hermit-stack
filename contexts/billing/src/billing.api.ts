import { Api } from "@alchemy.run/domain";

import { Billing } from "#src/billing.model.js";

// The processor's reports are left out on purpose: only its adapter sends them, from a verified webhook, so no client
// Can grant itself a plan.
class BillingApi extends Api(
  "BillingApi",
  {
    commands: ["CancelSubscription"],
    model: Billing,
    queries: [],
    streams: [],
    views: ["Entitlement"],
  },
  { description: "What a client of billing may send and read." },
) {}

export { BillingApi };
