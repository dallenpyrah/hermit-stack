import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { SubscriptionCancelled } from "#src/subscription/cancellation/subscription-cancelled.event.js";
import { Entitlement } from "#src/subscription/entitlement.view.js";
import { RecordSubscriptionStarted } from "#src/subscription/start/record-subscription-started.command.js";
import { SubscriptionStarted } from "#src/subscription/start/subscription-started.event.js";
import { billingStory, customer, endedAt, january, pro, reportAt, started } from "#tests/billing.suite";

type Case = () => ReturnType<typeof billingStory>;

// Story.then is renamed because a lint rule reads any .then( call as a Promise chain.
const { then: recorded } = Story;

const startsFromNothing: Case = () =>
  billingStory(
    Story.when(customer, RecordSubscriptionStarted.make(january)),
    recorded(customer, started),
    Story.view(Entitlement, customer, {
      cancelling: false,
      entitled: true,
      periodEnd: january.periodEnd,
      plan: pro,
      status: "active",
    }),
  );

const repeatChangesNothing: Case = () =>
  billingStory(
    Story.given(customer, started),
    Story.when(customer, RecordSubscriptionStarted.make(january)),
    recorded(customer),
  );

const startsAgainAfterCancelled: Case = () => {
  const april = reportAt("2026-04-01T00:00:00Z");
  const cancelled = SubscriptionCancelled.make(endedAt("2026-03-01T00:00:00Z"));

  return billingStory(
    Story.given(customer, started, cancelled),
    Story.when(customer, RecordSubscriptionStarted.make(april)),
    recorded(customer, SubscriptionStarted.make(april)),
    Story.view(Entitlement, customer, {
      cancelling: false,
      entitled: true,
      periodEnd: april.periodEnd,
      plan: pro,
      status: "active",
    }),
  );
};

describe("a processor's report that a subscription started", () => {
  it.effect("records the start and entitles the customer to the plan until the period ends", startsFromNothing);
  it.effect("records nothing when the same report arrives again", repeatChangesNothing);
  it.effect("starts a new subscription for a customer whose last one was cancelled earlier", startsAgainAfterCancelled);
});
