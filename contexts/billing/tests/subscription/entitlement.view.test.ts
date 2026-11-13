import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { SubscriptionCancelled } from "#src/subscription/cancellation/subscription-cancelled.event.js";
import { Entitlement } from "#src/subscription/entitlement.view.js";
import { PaymentFailed } from "#src/subscription/payment-failure/payment-failed.event.js";
import { SubscriptionRenewed } from "#src/subscription/renew/subscription-renewed.event.js";
import { billingStory, customer, endedAt, january, pro, reportAt, started } from "#tests/billing.suite";

type Case = () => ReturnType<typeof billingStory>;

const february = reportAt("2026-02-01T00:00:00Z");

const march = reportAt("2026-03-01T00:00:00Z");

const cancelled = SubscriptionCancelled.make(endedAt("2026-03-20T00:00:00Z"));

const paid = { cancelling: false, entitled: true, plan: pro };

// Each command's story shows the event it records; this one shows what the app reads after each event in turn.
const followsTheLifecycle: Case = () =>
  billingStory(
    Story.view(Entitlement, customer, Story.none),
    Story.given(customer, started),
    Story.view(Entitlement, customer, { ...paid, periodEnd: january.periodEnd, status: "active" }),
    Story.given(customer, SubscriptionRenewed.make(february)),
    Story.view(Entitlement, customer, { ...paid, periodEnd: february.periodEnd, status: "active" }),
    Story.given(customer, PaymentFailed.make(march)),
    Story.view(Entitlement, customer, { ...paid, periodEnd: march.periodEnd, status: "past_due" }),
    Story.given(customer, cancelled),
    Story.view(Entitlement, customer, { cancelling: false, entitled: false, status: "cancelled" }),
  );

describe("a customer's entitlement", () => {
  it.effect(
    "follows the subscription from none through active, renewed and past due to cancelled",
    followsTheLifecycle,
  );
});
