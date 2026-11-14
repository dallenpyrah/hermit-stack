import { Rejection } from "@alchemy.run/domain";

import { PlanId } from "#src/subscription/plan.schema.js";

class UnknownPlan extends Rejection(
  "UnknownPlan",
  { plan: PlanId },
  { description: "The processor sells no price for this plan." },
) {}

export { UnknownPlan };
