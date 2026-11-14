import type { Identifier } from "@alchemy.run/domain/ExternalSystem";
import { expect } from "@effect/vitest";
import type { Vitest } from "@effect/vitest";
import { Effect } from "effect";

import { PayerNotFound } from "#src/payments/payer-not-found.rejection.js";
import { Payments } from "#src/payments/payments.external.js";
import { SubscriptionNotFound } from "#src/payments/subscription-not-found.rejection.js";
import { UnknownPlan } from "#src/payments/unknown-plan.rejection.js";
import { CustomerId } from "#src/subscription/customer.id.js";
import { PlanId } from "#src/subscription/plan.schema.js";

type PaymentsService = Identifier<typeof Payments>;

interface Held {
  readonly payer: string;
  readonly plan: PlanId;
  readonly subscription: string;
}

const customer = CustomerId.make("customer-1");

const unsoldPlan = PlanId.make("plan-nobody-sells");

const unknownPayer = "payer-nobody-holds";

const unknownSubscription = "subscription-nobody-holds";

const checkout = { cancelUrl: "https://app.example/pricing", customer, successUrl: "https://app.example/welcome" };

const returnUrl = "https://app.example/account";

const secureUrl = /^https:\/\/[^/\s]+\/\S*$/u;

const startsCheckout = Effect.fn("startsCheckout")(function* startsCheckoutCase(held: Held) {
  const payments = yield* Payments;
  const { url } = yield* payments.startCheckout({ ...checkout, plan: held.plan });

  expect(url).toMatch(secureUrl);
});

const refusesUnsoldPlan = Effect.gen(function* refusesUnsoldPlanCase() {
  const payments = yield* Payments;
  const refused = yield* Effect.flip(payments.startCheckout({ ...checkout, plan: unsoldPlan }));

  expect(refused).toStrictEqual(new UnknownPlan({ plan: unsoldPlan }));
});

const opensPortal = Effect.fn("opensPortal")(function* opensPortalCase(held: Held) {
  const payments = yield* Payments;
  const { url } = yield* payments.openPortal({ payer: held.payer, returnUrl });

  expect(url).toMatch(secureUrl);
});

const refusesUnknownPayer = Effect.gen(function* refusesUnknownPayerCase() {
  const payments = yield* Payments;
  const refused = yield* Effect.flip(payments.openPortal({ payer: unknownPayer, returnUrl }));

  expect(refused).toStrictEqual(new PayerNotFound({ payer: unknownPayer }));
});

const cancelsTwice = Effect.fn("cancelsTwice")(function* cancelsTwiceCase(held: Held) {
  const payments = yield* Payments;

  yield* payments.cancel({ subscription: held.subscription });
  yield* payments.cancel({ subscription: held.subscription });
});

const refusesUnknownSubscription = Effect.gen(function* refusesUnknownSubscriptionCase() {
  const payments = yield* Payments;
  const refused = yield* Effect.flip(payments.cancel({ subscription: unknownSubscription }));

  expect(refused).toStrictEqual(new SubscriptionNotFound({ subscription: unknownSubscription }));
});

const paymentsContract =
  (held: Held) =>
  (onAdapter: Vitest.MethodsNonLive<PaymentsService>): void => {
    onAdapter.effect("starts a checkout for a plan it sells and answers a secure URL", () => startsCheckout(held));
    onAdapter.effect("refuses a checkout for a plan it does not sell with UnknownPlan", () => refusesUnsoldPlan);
    onAdapter.effect("opens the billing portal for a payer it holds and answers a secure URL", () => opensPortal(held));
    onAdapter.effect("refuses the portal for a payer it does not hold with PayerNotFound", () => refusesUnknownPayer);
    onAdapter.effect("cancels a subscription it holds, and cancelling it again also succeeds", () =>
      cancelsTwice(held),
    );
    onAdapter.effect(
      "refuses to cancel a subscription it does not hold with SubscriptionNotFound",
      () => refusesUnknownSubscription,
    );
  };

export { paymentsContract };
