import { Match } from "effect";

import type { HeldReport } from "#src/subscription/processor-report.schema.js";
import { Active, PastDue } from "#src/subscription/subscription-state.schema.js";
import type { SubscribedState, SubscriptionState } from "#src/subscription/subscription-state.schema.js";

interface Applied {
  readonly cancelling: boolean;
  readonly precedence: number;
  readonly report: HeldReport;
}

// A cancellation the customer asked for survives a renewal or a failed payment reported after it; only a new start
// Clears it.
const isCancelling = (state: SubscriptionState): boolean =>
  Match.valueTags(state, {
    Active: (active) => active.cancelling,
    Cancelled: () => false,
    NoSubscription: () => false,
    PastDue: (pastDue) => pastDue.cancelling,
  });

const subscribedFrom = ({ cancelling, precedence, report }: Applied): Omit<SubscribedState, "_tag"> => ({
  cancelling,
  last: { at: report.reportedAt, precedence },
  payer: report.payer,
  periodEnd: report.periodEnd,
  plan: report.plan,
  subscription: report.subscription,
});

const markCancelling = (state: SubscriptionState): SubscriptionState =>
  Match.valueTags(state, {
    Active: (active) => Active.make({ ...active, cancelling: true }),
    Cancelled: (current) => current,
    NoSubscription: (current) => current,
    PastDue: (pastDue) => PastDue.make({ ...pastDue, cancelling: true }),
  });

export { isCancelling, markCancelling, subscribedFrom };
