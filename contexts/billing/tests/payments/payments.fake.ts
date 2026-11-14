import type { Identifier } from "@alchemy.run/domain/ExternalSystem";
import { Array as Arr, Effect } from "effect";
import type { Layer } from "effect";

import { PayerNotFound } from "#src/payments/payer-not-found.rejection.js";
import { Payments } from "#src/payments/payments.external.js";
import { SubscriptionNotFound } from "#src/payments/subscription-not-found.rejection.js";
import { UnknownPlan } from "#src/payments/unknown-plan.rejection.js";
import type { PlanId } from "#src/subscription/plan.schema.js";

interface Holdings {
  readonly payers: readonly string[];
  readonly plans: readonly PlanId[];
  readonly subscriptions: readonly string[];
}

interface Link {
  readonly url: string;
}

const PaymentsFake = (holdings: Holdings): Layer.Layer<Identifier<typeof Payments>> =>
  Payments.toLayer(
    Effect.succeed({
      cancel: ({ subscription }): Effect.Effect<void, SubscriptionNotFound> => {
        if (!Arr.contains(holdings.subscriptions, subscription)) {
          return Effect.fail(new SubscriptionNotFound({ subscription }));
        }

        return Effect.void;
      },
      openPortal: ({ payer }): Effect.Effect<Link, PayerNotFound> => {
        if (!Arr.contains(holdings.payers, payer)) {
          return Effect.fail(new PayerNotFound({ payer }));
        }

        return Effect.succeed({ url: `https://payments.example/portal/${payer}` });
      },
      startCheckout: ({ customer, plan }): Effect.Effect<Link, UnknownPlan> => {
        if (!Arr.contains(holdings.plans, plan)) {
          return Effect.fail(new UnknownPlan({ plan }));
        }

        return Effect.succeed({ url: `https://payments.example/checkout/${customer}/${plan}` });
      },
    }),
  );

export { PaymentsFake };
