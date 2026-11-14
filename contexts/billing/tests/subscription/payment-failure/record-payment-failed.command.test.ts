import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { Entitlement } from "#src/subscription/entitlement.view.js";
import { PaymentFailed } from "#src/subscription/payment-failure/payment-failed.event.js";
import { RecordPaymentFailed } from "#src/subscription/payment-failure/record-payment-failed.command.js";
import { SubscriptionRenewed } from "#src/subscription/renew/subscription-renewed.event.js";
import { billingStory, customer, pro, reportAt, started } from "#tests/billing.suite";

type Case = () => ReturnType<typeof billingStory>;

const { then: recorded } = Story;

const february = reportAt("2026-02-01T00:00:00Z");

const keepsThePlanWhileRetrying: Case = () =>
  billingStory(
    Story.given(customer, started),
    Story.when(customer, RecordPaymentFailed.make(february)),
    recorded(customer, PaymentFailed.make(february)),
    Story.view(Entitlement, customer, {
      cancelling: false,
      entitled: true,
      periodEnd: february.periodEnd,
      plan: pro,
      status: "past_due",
    }),
  );

const retriedRenewal = SubscriptionRenewed.make(reportAt("2026-02-04T00:00:00Z"));

const lateFailureChangesNothing: Case = () =>
  billingStory(
    Story.given(customer, started, retriedRenewal),
    Story.when(customer, RecordPaymentFailed.make(february)),
    recorded(customer),
  );

describe("a processor's report that a renewal payment failed", () => {
  it.effect(
    "marks the subscription past due and keeps the plan while the processor retries",
    keepsThePlanWhileRetrying,
  );
  it.effect("records nothing when a later renewal has already been applied", lateFailureChangesNothing);
});
