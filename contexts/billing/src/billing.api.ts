import { Api } from "@alchemy.run/domain";

import { Billing } from "#src/billing.model.js";

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
