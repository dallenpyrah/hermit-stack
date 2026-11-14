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

type Prices = Readonly<Record<string, string>>;

interface StripeWebhookOptions {
  readonly prices: Prices;
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

interface Delivery {
  readonly customer: string;
  readonly report: ProcessorReport;
}

interface Paid {
  readonly periodEnd: DateTime.Utc;
  readonly plan: PlanId;
}

interface Held extends Paid {
  readonly payer: string;
  readonly reportedAt: DateTime.Utc;
  readonly subscription: string;
}

const millisPerSecond = 1000;

const okStatus = 200;

const badRequestStatus = 400;

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

const deliveryOf = (event: StripeEvent, prices: Prices): Option.Option<Delivery> => {
  if (event.type === "customer.subscription.deleted") {
    return cancellationDelivery(event);
  }

  return invoiceDelivery(event, prices);
};

const answer = (status: number): HttpServerResponse.HttpServerResponse => HttpServerResponse.empty({ status });

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
