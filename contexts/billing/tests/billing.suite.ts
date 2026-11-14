import { Story } from "@alchemy.run/domain/Story";
import { DateTime } from "effect";

import { BillingHandlers } from "#src/billing.layer.js";
import { Billing } from "#src/billing.model.js";
import { Payments } from "#src/payments/payments.external.js";
import type { EndedReport, HeldReport } from "#src/subscription/processor-report.schema.js";
import { PlanId } from "#src/subscription/plan.schema.js";
import { SubscriptionStarted } from "#src/subscription/start/subscription-started.event.js";
import { Subscription } from "#src/subscription/subscription.aggregate.js";

const billingStory = Story.make(Billing, { layer: BillingHandlers, stub: [Payments] });

const customer = Subscription.ref("customer-1");

const pro = PlanId.make("pro");

const payer = "payer-1";

const subscription = "subscription-1";

const reportAt = (iso: string): HeldReport => {
  const reportedAt = DateTime.makeUnsafe(iso);

  return { payer, periodEnd: DateTime.add(reportedAt, { months: 1 }), plan: pro, reportedAt, subscription };
};

const endedAt = (iso: string): EndedReport => ({
  payer,
  reportedAt: DateTime.makeUnsafe(iso),
  subscription,
});

const january = reportAt("2026-01-01T00:00:00Z");

const started = SubscriptionStarted.make(january);

export { billingStory, customer, endedAt, january, pro, reportAt, started, subscription };
