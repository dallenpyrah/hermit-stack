import { Schema } from "effect";

const customerIdKey = "customerId";

const stripeEventTypes = ["invoice.paid", "invoice.payment_failed", "customer.subscription.deleted"] as const;

const Metadata = Schema.Record(Schema.String, Schema.String);

const EventData = Schema.Struct({ object: Schema.Unknown });

const StripeEvent = Schema.Struct({
  created: Schema.Int,
  data: EventData,
  id: Schema.String,
  type: Schema.String,
});

type StripeEvent = typeof StripeEvent.Type;

const LinePeriod = Schema.Struct({ end: Schema.Int });

const PriceDetails = Schema.Struct({ price: Schema.String });

const LinePricing = Schema.Struct({ price_details: Schema.optionalKey(PriceDetails) });

const InvoiceLine = Schema.Struct({ period: LinePeriod, pricing: Schema.NullOr(LinePricing) });

type InvoiceLine = typeof InvoiceLine.Type;

const InvoiceLines = Schema.Struct({ data: Schema.Array(InvoiceLine) });

const SubscriptionDetails = Schema.Struct({ metadata: Schema.NullOr(Metadata), subscription: Schema.String });

const InvoiceParent = Schema.Struct({ subscription_details: SubscriptionDetails });

const SubscriptionInvoice = Schema.Struct({
  billing_reason: Schema.NullOr(Schema.String),
  customer: Schema.String,
  lines: InvoiceLines,
  parent: InvoiceParent,
});

type SubscriptionInvoice = typeof SubscriptionInvoice.Type;

const EndedSubscription = Schema.Struct({ customer: Schema.String, id: Schema.String, metadata: Metadata });

export { customerIdKey, EndedSubscription, StripeEvent, stripeEventTypes, SubscriptionInvoice };

export type { InvoiceLine };
