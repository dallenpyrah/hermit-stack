import { Schema } from "effect";

import { PlanId } from "#src/subscription/plan.schema.js";

// The newest processor report applied so far: when it happened, and how final it is when two reports share a second.
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

// The processor failed to take a renewal payment and is retrying it.
const PastDue = Schema.TaggedStruct("PastDue", Subscribed);

const Cancelled = Schema.TaggedStruct("Cancelled", { last: Mark, payer: Schema.String, subscription: Schema.String });

// The state holds what the rules and the processor calls need. What a client reads is the Entitlement view, so this
// Can change freely.
const SubscriptionState = Schema.Union([NoSubscription, Active, PastDue, Cancelled]);

type SubscriptionState = typeof SubscriptionState.Type;

const SubscribedState = Schema.Union([Active, PastDue]);

type SubscribedState = typeof SubscribedState.Type;

export { Active, Cancelled, Mark, NoSubscription, PastDue, SubscriptionState };

export type { SubscribedState };
