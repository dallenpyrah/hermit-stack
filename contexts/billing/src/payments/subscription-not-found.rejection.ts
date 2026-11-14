import { Rejection } from "@alchemy.run/domain";
import { Schema } from "effect";

class SubscriptionNotFound extends Rejection(
  "SubscriptionNotFound",
  { subscription: Schema.String },
  { description: "The processor holds no subscription with this reference." },
) {}

export { SubscriptionNotFound };
