import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class AttemptFailed extends Event("AttemptFailed", {
  attempt: Schema.Int,
  reason: Schema.String,
  retryAt: Schema.DateTimeUtc,
}) {}

export { AttemptFailed };
