import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

// The attempt failed and another is due at retryAt.
class AttemptFailed extends Event("AttemptFailed", {
  attempt: Schema.Int,
  reason: Schema.String,
  retryAt: Schema.DateTimeUtc,
}) {}

export { AttemptFailed };
