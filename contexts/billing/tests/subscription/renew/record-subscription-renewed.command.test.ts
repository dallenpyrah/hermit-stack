import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { Entitlement } from "#src/subscription/entitlement.view.js";
import { PaymentFailed } from "#src/subscription/payment-failure/payment-failed.event.js";
import { RecordSubscriptionRenewed } from "#src/subscription/renew/record-subscription-renewed.command.js";
import { SubscriptionRenewed } from "#src/subscription/renew/subscription-renewed.event.js";
import { billingStory, customer, pro, reportAt, started } from "#tests/billing.suite";

type Case = () => ReturnType<typeof billingStory>;

const { then: recorded } = Story;

const february = reportAt("2026-02-01T00:00:00Z");

const movesThePeriodOn: Case = () =>
  billingStory(
    Story.given(customer, started),
    Story.when(customer, RecordSubscriptionRenewed.make(february)),
    recorded(customer, SubscriptionRenewed.make(february)),
    Story.view(Entitlement, customer, {
      cancelling: false,
      entitled: true,
      periodEnd: february.periodEnd,
      plan: pro,
      status: "active",
    }),
  );

const recoversFromPastDue: Case = () => {
  const retried = reportAt("2026-02-04T00:00:00Z");

  return billingStory(
    Story.given(customer, started, PaymentFailed.make(february)),
    Story.when(customer, RecordSubscriptionRenewed.make(retried)),
    recorded(customer, SubscriptionRenewed.make(retried)),
    Story.view(Entitlement, customer, {
      cancelling: false,
      entitled: true,
      periodEnd: retried.periodEnd,
      plan: pro,
      status: "active",
    }),
  );
};

const renewedInMarch = SubscriptionRenewed.make(reportAt("2026-03-01T00:00:00Z"));

const lateRenewalChangesNothing: Case = () =>
  billingStory(
    Story.given(customer, started, renewedInMarch),
    Story.when(customer, RecordSubscriptionRenewed.make(february)),
    recorded(customer),
  );

describe("a processor's report that a subscription renewed", () => {
  it.effect("records the renewal and moves the paid period on", movesThePeriodOn);
  it.effect("makes a past-due subscription active again when a retried payment goes through", recoversFromPastDue);
  it.effect("records nothing when it is older than the last report applied", lateRenewalChangesNothing);
});
