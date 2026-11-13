import { it } from "@effect/vitest";

import { PlanId } from "#src/subscription/plan.schema.js";
import { PaymentsFake } from "#tests/payments/payments.fake";
import { paymentsContract } from "#tests/payments/payments.suite";

const held = { payer: "payer-1", plan: PlanId.make("pro"), subscription: "subscription-1" };

const fake = PaymentsFake({ payers: [held.payer], plans: [held.plan], subscriptions: [held.subscription] });

it.layer(fake)("the Payments port through the in-memory fake", paymentsContract(held));
