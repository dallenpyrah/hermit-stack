import { PlanId } from "@repo/billing/plan";
import { RecordPaymentFailed } from "@repo/billing/record-payment-failed";
import { RecordSubscriptionCancelled } from "@repo/billing/record-subscription-cancelled";
import { RecordSubscriptionRenewed } from "@repo/billing/record-subscription-renewed";
import { RecordSubscriptionStarted } from "@repo/billing/record-subscription-started";
import { Subscription } from "@repo/billing/subscription";
import { Webhooks } from "@distilled.cloud/stripe";
import { Array as Arr, Context, DateTime, Effect, Layer, Option, Record as Rec, Schema, pipe } from "effect";
import type { Redacted } from "effect";
import { Headers, HttpServerResponse } from "effect/http";
import type { HttpServerRequest } from "effect/http";

import { customerIdKey, EndedSubscription, StripeEvent, SubscriptionInvoice } from "#src/stripe-event.schema.js";
import type { InvoiceLine } from "#src/stripe-event.schema.js";

// The Stripe price that sells each plan, keyed by the plan's id.
type Prices = Readonly<Record<string, string>>;

interface StripeWebhookOptions {
  // The same prices the payments layer is given.
  readonly prices: Prices;
  // The endpoint's signing secret.
  readonly secret: Redacted.Redacted;
}

interface StripeWebhookService {
  readonly handle: (
    request: HttpServerRequest.HttpServerRequest,
  ) => Effect.Effect<HttpServerResponse.HttpServerResponse>;
}

type ProcessorReport =
  | RecordPaymentFailed
  | RecordSubscriptionCancelled
  | RecordSubscriptionRenewed
  | RecordSubscriptionStarted;

// One billing command and the app's id for the customer it is about.
interface Delivery {
  readonly customer: string;
  readonly report: ProcessorReport;
}

interface Paid {
  readonly periodEnd: DateTime.Utc;
  readonly plan: PlanId;
}

// What Stripe reports about a subscription it still holds, in the words of billing's processor reports.
interface Held extends Paid {
  readonly payer: string;
  readonly reportedAt: DateTime.Utc;
  readonly subscription: string;
}

const millisPerSecond = 1000;

const okStatus = 200;

const badRequestStatus = 400;

// Stripe stamps times in whole seconds.
const atSecond = (seconds: number): DateTime.Utc => DateTime.makeUnsafe(seconds * millisPerSecond);

const customerIn = (metadata: Readonly<Record<string, string>> | null): Option.Option<string> =>
  pipe(Option.fromNullishOr(metadata), Option.flatMap(Rec.get(customerIdKey)));

const planSoldAt = (prices: Prices, price: string): Option.Option<PlanId> =>
  pipe(
    Arr.findFirst(Rec.toEntries(prices), ([, sold]) => sold === price),
    Option.map(([plan]) => PlanId.make(plan)),
  );

const paidLine = (prices: Prices, line: InvoiceLine): Option.Option<Paid> =>
  pipe(
    Option.fromNullishOr(line.pricing?.price_details?.price),
    Option.flatMap((price) => planSoldAt(prices, price)),
    Option.map((plan) => ({ periodEnd: atSecond(line.period.end), plan })),
  );

// A paid first invoice starts the subscription and a paid cycle invoice renews it. A failed first payment is left
// Out: Checkout never creates a subscription it could not charge, so there is nothing yet to put past due.
const reportOf = (kind: string, held: Held): Option.Option<ProcessorReport> => {
  if (kind === "invoice.paid subscription_create") {
    return Option.some(RecordSubscriptionStarted.make(held));
  }

  if (kind === "invoice.paid subscription_cycle") {
    return Option.some(RecordSubscriptionRenewed.make(held));
  }

  if (kind === "invoice.payment_failed subscription_cycle") {
    return Option.some(RecordPaymentFailed.make(held));
  }

  return Option.none();
};

const invoiceDelivery = (event: StripeEvent, prices: Prices): Option.Option<Delivery> =>
  Option.gen(function* fromInvoice() {
    const invoice = yield* Schema.decodeUnknownOption(SubscriptionInvoice)(event.data.object);
    const details = invoice.parent.subscription_details;
    const customer = yield* customerIn(details.metadata);
    const paid = yield* Arr.findFirst(invoice.lines.data, (line) => paidLine(prices, line));
    const kind = `${event.type} ${invoice.billing_reason ?? ""}`;
    const held = { ...paid, payer: invoice.customer, reportedAt: atSecond(event.created) };
    const report = yield* reportOf(kind, { ...held, subscription: details.subscription });

    return { customer, report };
  });

const cancellationDelivery = (event: StripeEvent): Option.Option<Delivery> =>
  Option.gen(function* fromEndedSubscription() {
    const ended = yield* Schema.decodeUnknownOption(EndedSubscription)(event.data.object);
    const customer = yield* customerIn(ended.metadata);
    const reportedAt = atSecond(event.created);
    const report = RecordSubscriptionCancelled.make({ payer: ended.customer, reportedAt, subscription: ended.id });

    return { customer, report };
  });

// An event billing does not understand, or one about a customer, price or subscription it does not know, is none, so
// The webhook acknowledges it and Stripe stops resending it.
const deliveryOf = (event: StripeEvent, prices: Prices): Option.Option<Delivery> => {
  if (event.type === "customer.subscription.deleted") {
    return cancellationDelivery(event);
  }

  return invoiceDelivery(event, prices);
};

const answer = (status: number): HttpServerResponse.HttpServerResponse => HttpServerResponse.empty({ status });

// A wrong signature, a timestamp outside Stripe's five-minute tolerance and a body that is not an event all come back
// As none, so the caller learns nothing about which check failed.
const verify = (
  request: HttpServerRequest.HttpServerRequest,
  secret: Redacted.Redacted,
): Effect.Effect<Option.Option<StripeEvent>> =>
  Effect.gen(function* verified() {
    const payload = yield* request.text;
    const signature = Option.getOrNull(Headers.get(request.headers, "stripe-signature"));
    const event = yield* Webhooks.constructEvent({ payload, secret, signature });

    return yield* Schema.decodeUnknownEffect(StripeEvent)(event);
  }).pipe(Effect.option);

// Turns each verified Stripe webhook into a command on the billing context. Stripe delivers at least once and in any
// Order: the event id is the command id, so a repeat is answered from the first receipt, and every report carries the
// Time Stripe stamped on it, so the Subscription aggregate drops one older than what it already applied. It answers
// 200 only after the command is accepted; a failure dies, the host answers 5xx, and Stripe sends the event again.
class StripeWebhook extends Context.Service<StripeWebhook, StripeWebhookService>()(
  "@repo/stripe/stripe-webhook.adapter/StripeWebhook",
) {
  public static readonly layer = (
    options: StripeWebhookOptions,
  ): Layer.Layer<StripeWebhook, never, Context.Service.Identifier<typeof Subscription>> =>
    Layer.effect(
      StripeWebhook,
      Effect.gen(function* stripeWebhook() {
        const subscriptions = yield* Subscription;

        const send = (event: StripeEvent, delivery: Delivery): Effect.Effect<void> => {
          const customer = Subscription.ref(delivery.customer);

          return Effect.asVoid(subscriptions.send(customer, delivery.report, { commandId: `stripe:${event.id}` }));
        };

        const apply = (event: StripeEvent): Effect.Effect<void> =>
          Option.match(deliveryOf(event, options.prices), {
            onNone: () => Effect.logDebug("Stripe event acknowledged without a billing command", event.type, event.id),
            onSome: (delivery) => send(event, delivery),
          });

        const handle = Effect.fn("StripeWebhook.handle")(function* handleDelivery(
          request: HttpServerRequest.HttpServerRequest,
        ) {
          const verified = yield* verify(request, options.secret);

          if (Option.isNone(verified)) {
            return answer(badRequestStatus);
          }

          yield* apply(verified.value);

          return answer(okStatus);
        });

        return StripeWebhook.of({ handle });
      }),
    );
}

export { StripeWebhook };

export type { StripeWebhookOptions };
