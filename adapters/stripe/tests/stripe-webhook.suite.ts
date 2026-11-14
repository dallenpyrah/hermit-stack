import { make as inMemory } from "@alchemy.run/domain/InMemory";
import { BillingHandlers } from "@repo/billing/handlers";
import { Billing } from "@repo/billing/model";
import { PaymentsFake } from "@repo/billing/payments-fake";
import { PlanId } from "@repo/billing/plan";
import { RecordPaymentFailed } from "@repo/billing/record-payment-failed";
import { RecordSubscriptionCancelled } from "@repo/billing/record-subscription-cancelled";
import { RecordSubscriptionRenewed } from "@repo/billing/record-subscription-renewed";
import { RecordSubscriptionStarted } from "@repo/billing/record-subscription-started";
import { DateTime, Layer } from "effect";

interface StripeJson {
  readonly [field: string]: number | string | StripeJson | readonly StripeJson[];
}

interface EventFixture {
  readonly created: number;
  readonly data: { readonly object: StripeJson };
  readonly id: string;
  readonly object: "event";
  readonly type: string;
}

interface InvoiceEvent {
  readonly created: number;
  readonly id: string;
  readonly periodEnd: number;
  readonly reason: string;
  readonly type: string;
}

const customer = "customer-1";

const prices = { pro: "price_pro" };

const millisPerSecond = 1000;

const second = (iso: string): number => DateTime.toEpochMillis(DateTime.makeUnsafe(iso)) / millisPerSecond;

const january = second("2026-01-01T00:00:00Z");

const february = second("2026-02-01T00:00:00Z");

const march = second("2026-03-01T00:00:00Z");

const april = second("2026-04-01T00:00:00Z");

const linePaidUntil = (periodEnd: number): StripeJson => ({
  period: { end: periodEnd },
  pricing: { price_details: { price: prices.pro } },
});

const invoiceEvent = ({ created, id, periodEnd, reason, type }: InvoiceEvent): EventFixture => ({
  created,
  data: {
    object: {
      billing_reason: reason,
      customer: "cus_1",
      lines: { data: [linePaidUntil(periodEnd)] },
      object: "invoice",
      parent: { subscription_details: { metadata: { customerId: customer }, subscription: "sub_1" } },
    },
  },
  id,
  object: "event",
  type,
});

const started = invoiceEvent({
  created: january,
  id: "evt_started",
  periodEnd: february,
  reason: "subscription_create",
  type: "invoice.paid",
});

const renewed = invoiceEvent({
  created: february,
  id: "evt_renewed",
  periodEnd: march,
  reason: "subscription_cycle",
  type: "invoice.paid",
});

const failed = invoiceEvent({
  created: march,
  id: "evt_failed",
  periodEnd: april,
  reason: "subscription_cycle",
  type: "invoice.payment_failed",
});

const deleted: EventFixture = {
  created: second("2026-03-20T00:00:00Z"),
  data: { object: { customer: "cus_1", id: "sub_1", metadata: { customerId: customer }, object: "subscription" } },
  id: "evt_deleted",
  object: "event",
  type: "customer.subscription.deleted",
};

const firstPaymentFailed = invoiceEvent({
  created: january,
  id: "evt_first_failed",
  periodEnd: february,
  reason: "subscription_create",
  type: "invoice.payment_failed",
});

const held = { payer: "cus_1", plan: PlanId.make("pro"), subscription: "sub_1" };

const at = (iso: string): DateTime.Utc => DateTime.makeUnsafe(iso);

const commands = {
  deleted: RecordSubscriptionCancelled.make({
    payer: held.payer,
    reportedAt: at("2026-03-20T00:00:00Z"),
    subscription: held.subscription,
  }),
  failed: RecordPaymentFailed.make({
    ...held,
    periodEnd: at("2026-04-01T00:00:00Z"),
    reportedAt: at("2026-03-01T00:00:00Z"),
  }),
  renewed: RecordSubscriptionRenewed.make({
    ...held,
    periodEnd: at("2026-03-01T00:00:00Z"),
    reportedAt: at("2026-02-01T00:00:00Z"),
  }),
  started: RecordSubscriptionStarted.make({
    ...held,
    periodEnd: at("2026-02-01T00:00:00Z"),
    reportedAt: at("2026-01-01T00:00:00Z"),
  }),
};

const unknownType: EventFixture = { ...deleted, id: "evt_customer", type: "customer.created" };

const hosted = Billing.layer(BillingHandlers).pipe(
  Layer.provide(PaymentsFake({ payers: [], plans: [], subscriptions: [] })),
);

interface BillingHost {
  readonly commits: () => number;
  readonly layer: Layer.Layer<Layer.Success<typeof hosted>>;
}

const billingHost = (): BillingHost => {
  const platform = inMemory();

  return { commits: () => platform.control.commits.length, layer: Layer.provide(hosted, platform.layer) };
};

export { billingHost, commands, customer, deleted, failed, firstPaymentFailed, prices, renewed, started, unknownType };

export type { EventFixture };
