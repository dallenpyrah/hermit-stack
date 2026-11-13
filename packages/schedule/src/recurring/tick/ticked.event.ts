import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

// The time the occurrence was due, the time it ran, and the next due time; at minus scheduledFor is how late it ran.
class Ticked extends Event("Ticked", {
  at: Schema.DateTimeUtc,
  nextDue: Schema.DateTimeUtc,
  scheduledFor: Schema.DateTimeUtc,
}) {}

export { Ticked };
