import type { Identifier } from "@alchemy.run/domain/ExternalSystem";
import { PayerNotFound } from "@repo/billing/payer-not-found";
import { Payments } from "@repo/billing/payments";
import { SubscriptionNotFound } from "@repo/billing/subscription-not-found";
import { UnknownPlan } from "@repo/billing/unknown-plan";
import { credentials, InvalidRequestError } from "@distilled.cloud/stripe";
import type { Credentials, StripeOpError } from "@distilled.cloud/stripe";
import { CreateBillingPortalSession, CreateCheckoutSession, UpdateSubscription } from "@distilled.cloud/stripe/stripe";
import type { CreateCheckoutSessionRequest } from "@distilled.cloud/stripe/stripe";
import { Effect, Layer, Option, Record as Rec } from "effect";
import type { Redacted } from "effect";
import { FetchHttpClient } from "effect/http";
import type { HttpClient } from "effect/http";

import { customerIdKey } from "#src/stripe-event.schema.js";

interface StripePaymentsOptions {
  readonly apiKey: Redacted.Redacted;
  readonly apiBaseUrl?: string;
  readonly prices: Readonly<Record<string, string>>;
}

interface Link {
  readonly url: string;
}

interface Checkout {
  readonly cancelUrl: string;
  readonly customer: string;
  readonly successUrl: string;
}

type PaymentsLayer = Layer.Layer<Identifier<typeof Payments>>;

const refusalOr = <Refusal>(refusal: Refusal, error: StripeOpError): Effect.Effect<never, Refusal> => {
  if (error instanceof InvalidRequestError && error.code === "resource_missing") {
    return Effect.fail(refusal);
  }

  return Effect.die(error);
};

const refuseMissing =
  <Refusal>(refusal: Refusal) =>
  <Success, Needs>(call: Effect.Effect<Success, StripeOpError, Needs>): Effect.Effect<Success, Refusal, Needs> =>
    Effect.matchEffect(call, { onFailure: (error) => refusalOr(refusal, error), onSuccess: Effect.succeed });

const urlOf = (answer: { readonly url: string | null }): Effect.Effect<Link> =>
  Option.match(Option.fromNullishOr(answer.url), {
    onNone: () => Effect.die(new Error("Stripe answered without a URL to send the browser to.")),
    onSome: (url) => Effect.succeed({ url }),
  });

const checkoutSession = (checkout: Checkout, price: string): CreateCheckoutSessionRequest => {
  const metadata = { [customerIdKey]: checkout.customer };

  return {
    cancel_url: checkout.cancelUrl,
    client_reference_id: checkout.customer,
    line_items: [{ price, quantity: 1 }],
    metadata,
    mode: "subscription",
    subscription_data: { metadata },
    success_url: checkout.successUrl,
  };
};

const StripePayments = (options: StripePaymentsOptions): PaymentsLayer => {
  const client = Layer.merge(credentials(options), FetchHttpClient.layer);

  const service = Payments.toLayer(
    Effect.gen(function* stripePayments() {
      const stripe = yield* Effect.context<Credentials | HttpClient.HttpClient>();

      return {
        cancel: ({ subscription }): Effect.Effect<void, SubscriptionNotFound> =>
          UpdateSubscription({ cancel_at_period_end: true, subscription_exposed_id: subscription }).pipe(
            refuseMissing(new SubscriptionNotFound({ subscription })),
            Effect.asVoid,
            Effect.provideContext(stripe),
          ),
        openPortal: ({ payer, returnUrl }): Effect.Effect<Link, PayerNotFound> =>
          CreateBillingPortalSession({ customer: payer, return_url: returnUrl }).pipe(
            refuseMissing(new PayerNotFound({ payer })),
            Effect.flatMap(urlOf),
            Effect.provideContext(stripe),
          ),
        startCheckout: (checkout): Effect.Effect<Link, UnknownPlan> => {
          const refusal = new UnknownPlan({ plan: checkout.plan });

          return Option.match(Rec.get(options.prices, checkout.plan), {
            onNone: () => Effect.fail(refusal),
            onSome: (price) =>
              CreateCheckoutSession(checkoutSession(checkout, price)).pipe(
                refuseMissing(refusal),
                Effect.flatMap(urlOf),
                Effect.provideContext(stripe),
              ),
          });
        },
      };
    }),
  );

  return Layer.provide(service, client);
};

export { StripePayments };

export type { StripePaymentsOptions };
