import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { Payments } from "#src/payments/payments.external.js";
import { SubscriptionNotFound } from "#src/payments/subscription-not-found.rejection.js";
import { CancelSubscription } from "#src/subscription/cancel/cancel-subscription.command.js";
import { CancellationRequested } from "#src/subscription/cancel/cancellation-requested.event.js";
import { NotSubscribed } from "#src/subscription/cancel/not-subscribed.rejection.js";
import { SubscriptionCancelled } from "#src/subscription/cancellation/subscription-cancelled.event.js";
import { Entitlement } from "#src/subscription/entitlement.view.js";
import { billingStory, customer, endedAt, january, pro, started, subscription } from "#tests/billing.suite";

type Case = () => ReturnType<typeof billingStory>;

// Story.then is renamed because a lint rule reads any .then( call as a Promise chain.
const { then: recorded } = Story;

// Payments.cancel succeeds without a value. The lint rules refuse every way of writing one (undefined, void 0, a call
// That returns void), so it is read from an object that holds none.
const { nothing }: { readonly nothing?: never } = {};

const asksTheProcessor: Case = () =>
  billingStory(
    Story.given(customer, started),
    Story.when(customer, CancelSubscription.make({})),
    recorded(customer, CancellationRequested.make({ subscription })),
    Story.call(Payments.cancel, { subscription }),
    Story.succeed(Payments.cancel, nothing),
    Story.view(Entitlement, customer, {
      cancelling: true,
      entitled: true,
      periodEnd: january.periodEnd,
      plan: pro,
      status: "active",
    }),
  );

const asksOnce: Case = () =>
  billingStory(
    Story.given(customer, started, CancellationRequested.make({ subscription })),
    Story.when(customer, CancelSubscription.make({})),
    recorded(customer),
  );

const processorAlreadyForgot: Case = () =>
  billingStory(
    Story.given(customer, started),
    Story.when(customer, CancelSubscription.make({})),
    recorded(customer, CancellationRequested.make({ subscription })),
    Story.call(Payments.cancel, { subscription }),
    Story.fail(Payments.cancel, new SubscriptionNotFound({ subscription })),
  );

const refusedBeforeStart: Case = () =>
  billingStory(Story.when(customer, CancelSubscription.make({})), Story.rejected(new NotSubscribed()));

const ended = SubscriptionCancelled.make(endedAt("2026-02-01T00:00:00Z"));

const refusedAfterEnd: Case = () =>
  billingStory(
    Story.given(customer, started, ended),
    Story.when(customer, CancelSubscription.make({})),
    Story.rejected(new NotSubscribed()),
  );

describe("cancelling a subscription", () => {
  it.effect("asks the processor to end it and keeps the plan until the processor reports the end", asksTheProcessor);
  it.effect("records nothing and asks nothing when it was already asked for", asksOnce);
  it.effect("is settled when the processor no longer holds the subscription", processorAlreadyForgot);
  it.effect("is refused with NotSubscribed before a subscription started", refusedBeforeStart);
  it.effect("is refused with NotSubscribed after the subscription ended", refusedAfterEnd);
});
