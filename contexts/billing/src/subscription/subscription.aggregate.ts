import { Aggregate } from "@alchemy.run/domain";

import { CancelSubscription, decideCancelSubscription } from "#src/subscription/cancel/cancel-subscription.command.js";
import {
  decideRecordSubscriptionCancelled,
  RecordSubscriptionCancelled,
} from "#src/subscription/cancellation/record-subscription-cancelled.command.js";
import { CustomerId } from "#src/subscription/customer.id.js";
import {
  decideRecordPaymentFailed,
  RecordPaymentFailed,
} from "#src/subscription/payment-failure/record-payment-failed.command.js";
import {
  decideRecordSubscriptionRenewed,
  RecordSubscriptionRenewed,
} from "#src/subscription/renew/record-subscription-renewed.command.js";
import { precedence } from "#src/subscription/report-order.pure.js";
import {
  decideRecordSubscriptionStarted,
  RecordSubscriptionStarted,
} from "#src/subscription/start/record-subscription-started.command.js";
import { isCancelling, markCancelling, subscribedFrom } from "#src/subscription/subscription-state.pure.js";
import {
  Active,
  Cancelled,
  NoSubscription,
  PastDue,
  SubscriptionState,
} from "#src/subscription/subscription-state.schema.js";

class Subscription extends Aggregate(
  "Subscription",
  {
    commands: [
      RecordSubscriptionStarted,
      RecordSubscriptionRenewed,
      RecordPaymentFailed,
      RecordSubscriptionCancelled,
      CancelSubscription,
    ],
    decide: {
      CancelSubscription: decideCancelSubscription,
      RecordPaymentFailed: decideRecordPaymentFailed,
      RecordSubscriptionCancelled: decideRecordSubscriptionCancelled,
      RecordSubscriptionRenewed: decideRecordSubscriptionRenewed,
      RecordSubscriptionStarted: decideRecordSubscriptionStarted,
    },
    evolve: {
      CancellationRequested: markCancelling,
      PaymentFailed: (state, report) =>
        PastDue.make(subscribedFrom({ cancelling: isCancelling(state), precedence: precedence.paymentFailed, report })),
      SubscriptionCancelled: (_state, event) =>
        Cancelled.make({
          last: { at: event.reportedAt, precedence: precedence.cancelled },
          payer: event.payer,
          subscription: event.subscription,
        }),
      SubscriptionRenewed: (state, report) =>
        Active.make(subscribedFrom({ cancelling: isCancelling(state), precedence: precedence.renewed, report })),
      SubscriptionStarted: (_state, report) =>
        Active.make(subscribedFrom({ cancelling: false, precedence: precedence.started, report })),
    },
    id: CustomerId,
    initial: NoSubscription.make({}),
    state: SubscriptionState,
  },
  {
    description:
      "What one customer may use: their plan and whether it is paid, as the payment processor reports it, and any cancellation they asked for.",
  },
) {}

export { Subscription };
