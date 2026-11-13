import { Schema } from "effect";

// The metadata key that carries the app's customer id through Stripe. The checkout writes it on the session and on
// The subscription it creates, and Stripe copies the subscription's metadata onto each of its invoices.
const customerIdKey = "customerId";

// The Stripe events the webhook endpoint must send. Every other event is acknowledged and changes nothing.
const stripeEventTypes = ["invoice.paid", "invoice.payment_failed", "customer.subscription.deleted"] as const;

const Metadata = Schema.Record(Schema.String, Schema.String);

const EventData = Schema.Struct({ object: Schema.Unknown });

// The envelope of every event, after its signature is checked. created is in seconds.
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

// Only the fields billing reads, in the shape of Stripe API versions from 2025-03-31 on, where an invoice names its
// Subscription under parent.subscription_details and a line names its price under pricing.price_details.
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
