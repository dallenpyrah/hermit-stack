import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { UrlParams } from "effect/http";

import { CustomerId } from "@repo/billing/customer-id";
import { Payments } from "@repo/billing/payments";
import { paymentsContract } from "@repo/billing/payments-suite";
import { PlanId } from "@repo/billing/plan";
import { UnknownPlan } from "@repo/billing/unknown-plan";

import { StripePayments } from "#src/stripe-payments.layer.js";
import { standInKey, startStripeStandIn } from "#tests/stripe-payments.fake";

const pro = PlanId.make("pro");

const retired = PlanId.make("retired");

const account = { customers: ["cus_held"], prices: ["price_pro"], subscriptions: ["sub_held"] };

const prices = { [pro]: "price_pro", [retired]: "price_archived" };

const customer = CustomerId.make("customer-7");

const checkout = { cancelUrl: "https://app.example/pricing", customer, successUrl: "https://app.example/welcome" };

const onStandIn = Effect.map(startStripeStandIn(account), (standIn) => ({
  payments: StripePayments({ apiBaseUrl: standIn.baseUrl, apiKey: standInKey, prices }),
  standIn,
}));

const stripe = Layer.unwrap(Effect.map(onStandIn, ({ payments }) => payments));

describe("the Payments contract", () => {
  it.layer(stripe)(
    "through Stripe, against a local stand-in for its API",
    paymentsContract({ payer: "cus_held", plan: pro, subscription: "sub_held" }),
  );
});

const carriesTheCustomer = Effect.gen(function* carriesTheCustomer() {
  const { payments, standIn } = yield* onStandIn;
  const built = yield* Layer.build(payments);

  yield* Context.get(built, Payments).startCheckout({ ...checkout, plan: pro });

  const [sent] = yield* standIn.received;

  expect(sent?.path).toBe("/v1/checkout/sessions");
  expect(UrlParams.toReadonlyRecord(sent?.form ?? UrlParams.empty)).toMatchObject({
    cancel_url: checkout.cancelUrl,
    client_reference_id: customer,
    "line_items[0][price]": "price_pro",
    "line_items[0][quantity]": "1",
    "metadata[customerId]": customer,
    mode: "subscription",
    "subscription_data[metadata][customerId]": customer,
    success_url: checkout.successUrl,
  });
});

const archivedPriceIsUnknown = Effect.gen(function* archivedPriceIsUnknown() {
  const { payments } = yield* onStandIn;
  const built = yield* Layer.build(payments);
  const refused = yield* Effect.flip(Context.get(built, Payments).startCheckout({ ...checkout, plan: retired }));

  expect(refused).toStrictEqual(new UnknownPlan({ plan: retired }));
});

describe("stripe as the payment processor", () => {
  it.effect("puts the customer id on the checkout and on the subscription it creates", () => carriesTheCustomer);
  it.effect("refuses a plan whose price Stripe no longer has with UnknownPlan", () => archivedPriceIsUnknown);
});
