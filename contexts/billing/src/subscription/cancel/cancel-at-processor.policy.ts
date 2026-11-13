import { Policy } from "@alchemy.run/domain";
import { Effect } from "effect";

import { Payments } from "#src/payments/payments.external.js";
import { CancellationRequested } from "#src/subscription/cancel/cancellation-requested.event.js";
import { Subscription } from "#src/subscription/subscription.aggregate.js";

const CancelAtProcessor = Policy(
  "CancelAtProcessor",
  { from: Subscription, on: [CancellationRequested] },
  { description: "Asks the payment processor to end a subscription the customer cancelled, at the end of its period." },
);

// Records nothing back: the processor reports the end itself when the period is over, as SubscriptionCancelled.
const CancelAtProcessorLive = CancelAtProcessor.toLayer(
  Effect.gen(function* cancelAtProcessorLive() {
    const payments = yield* Payments;

    return Effect.fn("CancelAtProcessor.handle")(function* handle({ event }) {
      yield* payments
        .cancel({ subscription: event.subscription })
        .pipe(
          Effect.catchTag("SubscriptionNotFound", (gone) =>
            Effect.logWarning("The processor no longer holds the subscription a customer cancelled", gone.subscription),
          ),
        );
    });
  }),
);

export { CancelAtProcessor, CancelAtProcessorLive };
