import { Schema } from "effect";

import { PlanId } from "#src/subscription/plan.schema.js";

const Mark = Schema.Struct({ at: Schema.DateTimeUtc, precedence: Schema.Int });

type Mark = typeof Mark.Type;

const Subscribed = {
  cancelling: Schema.Boolean,
  last: Mark,
  payer: Schema.String,
  periodEnd: Schema.DateTimeUtc,
  plan: PlanId,
  subscription: Schema.String,
};

const NoSubscription = Schema.TaggedStruct("NoSubscription", {});

const Active = Schema.TaggedStruct("Active", Subscribed);

const PastDue = Schema.TaggedStruct("PastDue", Subscribed);

const Cancelled = Schema.TaggedStruct("Cancelled", { last: Mark, payer: Schema.String, subscription: Schema.String });

const SubscriptionState = Schema.Union([NoSubscription, Active, PastDue, Cancelled]);

type SubscriptionState = typeof SubscriptionState.Type;

const SubscribedState = Schema.Union([Active, PastDue]);

type SubscribedState = typeof SubscribedState.Type;

export { Active, Cancelled, Mark, NoSubscription, PastDue, SubscriptionState };

export type { SubscribedState };
