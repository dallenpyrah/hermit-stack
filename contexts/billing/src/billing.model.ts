import { Model } from "@alchemy.run/domain";

import { CancelAtProcessor } from "#src/subscription/cancel/cancel-at-processor.policy.js";
import { Entitlement } from "#src/subscription/entitlement.view.js";
import { Subscription } from "#src/subscription/subscription.aggregate.js";

class Billing extends Model(
  "Billing",
  { aggregates: [Subscription], policies: [CancelAtProcessor], views: [Entitlement] },
  { description: "What each customer may use, kept in step with the payment processor that takes their money." },
) {}

export { Billing };
