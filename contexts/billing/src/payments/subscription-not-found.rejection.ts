import { Rejection } from "@alchemy.run/domain";
import { Schema } from "effect";

// The policy that cancels treats this as done: the processor no longer has the subscription to end.
class SubscriptionNotFound extends Rejection(
  "SubscriptionNotFound",
  { subscription: Schema.String },
  { description: "The processor holds no subscription with this reference." },
) {}

export { SubscriptionNotFound };
