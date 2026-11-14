import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { RecordSubscriptionCancelled } from "#src/subscription/cancellation/record-subscription-cancelled.command.js";
import { SubscriptionCancelled } from "#src/subscription/cancellation/subscription-cancelled.event.js";
import { Entitlement } from "#src/subscription/entitlement.view.js";
import { PaymentFailed } from "#src/subscription/payment-failure/payment-failed.event.js";
import { RecordPaymentFailed } from "#src/subscription/payment-failure/record-payment-failed.command.js";
import { RecordSubscriptionRenewed } from "#src/subscription/renew/record-subscription-renewed.command.js";
import { billingStory, customer, endedAt, reportAt, started } from "#tests/billing.suite";

type Case = () => ReturnType<typeof billingStory>;

const { then: recorded } = Story;

const finalSecond = "2026-02-15T00:00:00Z";

const failedInFinalSecond = reportAt(finalSecond);

const cancelledInFinalSecond = endedAt(finalSecond);

const endsAccess: Case = () => {
  const ended = endedAt("2026-02-01T00:00:00Z");

  return billingStory(
    Story.given(customer, started),
    Story.when(customer, RecordSubscriptionCancelled.make(ended)),
    recorded(customer, SubscriptionCancelled.make(ended)),
    Story.view(Entitlement, customer, { cancelling: false, entitled: false, status: "cancelled" }),
  );
};

const winsTheSameSecondAfter: Case = () =>
  billingStory(
    Story.given(customer, started, PaymentFailed.make(failedInFinalSecond)),
    Story.when(customer, RecordSubscriptionCancelled.make(cancelledInFinalSecond)),
    recorded(customer, SubscriptionCancelled.make(cancelledInFinalSecond)),
  );

const winsTheSameSecondBefore: Case = () =>
  billingStory(
    Story.given(customer, started, SubscriptionCancelled.make(cancelledInFinalSecond)),
    Story.when(customer, RecordPaymentFailed.make(failedInFinalSecond)),
    recorded(customer),
    Story.view(Entitlement, customer, { cancelling: false, entitled: false, status: "cancelled" }),
  );

const cancelledMidFebruary = SubscriptionCancelled.make(endedAt("2026-02-15T00:00:00Z"));

const renewedFebruaryFirst = RecordSubscriptionRenewed.make(reportAt("2026-02-01T00:00:00Z"));

const lateRenewalChangesNothing: Case = () =>
  billingStory(
    Story.given(customer, started, cancelledMidFebruary),
    Story.when(customer, renewedFebruaryFirst),
    recorded(customer),
  );

describe("a processor's report that a subscription was cancelled", () => {
  it.effect("records the end and takes the plan away", endsAccess);
  it.effect("is recorded after a failed payment reported in the same second", winsTheSameSecondAfter);
  it.effect("is kept when a failed payment from the same second arrives after it", winsTheSameSecondBefore);
  it.effect("is kept when a renewal from before it arrives late", lateRenewalChangesNothing);
});
