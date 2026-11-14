import { Command } from "@alchemy.run/domain";
import { Match } from "effect";

import { CancellationRequested } from "#src/subscription/cancel/cancellation-requested.event.js";
import { NotSubscribed } from "#src/subscription/cancel/not-subscribed.rejection.js";
import { CustomerId } from "#src/subscription/customer.id.js";
import type { SubscribedState, SubscriptionState } from "#src/subscription/subscription-state.schema.js";

class CancelSubscription extends Command(
  "CancelSubscription",
  {
    events: [CancellationRequested],
    rejects: [NotSubscribed],
    target: CustomerId,
  },
  { description: "Stop a customer's subscription at the end of the period they have paid for." },
) {}

type Cancelling = NotSubscribed | readonly CancellationRequested[];

const notSubscribed = (): NotSubscribed => new NotSubscribed();

const requestOnce = (subscribed: SubscribedState): Cancelling => {
  if (subscribed.cancelling) {
    return [];
  }

  return [CancellationRequested.make({ subscription: subscribed.subscription })];
};

const decideCancelSubscription = (state: SubscriptionState): Cancelling =>
  Match.valueTags(state, {
    Active: requestOnce,
    Cancelled: notSubscribed,
    NoSubscription: notSubscribed,
    PastDue: requestOnce,
  });

export { CancelSubscription, decideCancelSubscription };
