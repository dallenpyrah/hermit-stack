import { View } from "@alchemy.run/domain";
import { Schema } from "effect";
import type { DateTime } from "effect";

import { PlanId } from "#src/subscription/plan.schema.js";
import { Subscription } from "#src/subscription/subscription.aggregate.js";

const EntitlementState = Schema.Struct({
  cancelling: Schema.Boolean,
  entitled: Schema.Boolean,
  periodEnd: Schema.optionalKey(Schema.DateTimeUtc),
  plan: Schema.optionalKey(PlanId),
  status: Schema.Literals(["none", "active", "past_due", "cancelled"]),
});

type EntitlementState = typeof EntitlementState.Type;

interface Paid {
  readonly periodEnd: DateTime.Utc;
  readonly plan: PlanId;
}

const paidFor = (event: Paid): Pick<EntitlementState, "periodEnd" | "plan"> => ({
  periodEnd: event.periodEnd,
  plan: event.plan,
});

class Entitlement extends View(
  "Entitlement",
  {
    evolve: {
      CancellationRequested: (state) => ({ ...state, cancelling: true }),
      PaymentFailed: (state, event) => ({ ...state, ...paidFor(event), entitled: true, status: "past_due" as const }),
      SubscriptionCancelled: () => ({ cancelling: false, entitled: false, status: "cancelled" as const }),
      SubscriptionRenewed: (state, event) => ({
        ...state,
        ...paidFor(event),
        entitled: true,
        status: "active" as const,
      }),
      SubscriptionStarted: (_state, event) => ({
        ...paidFor(event),
        cancelling: false,
        entitled: true,
        status: "active" as const,
      }),
    },
    from: [Subscription],
    initial: { cancelling: false, entitled: false, status: "none" },
    key: Subscription,
    state: EntitlementState,
  },
  {
    description:
      "Whether a customer may use their plan, which plan, until when it is paid, and whether it ends at the end of the period.",
  },
) {}

export { Entitlement };
