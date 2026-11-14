import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class Ticked extends Event("Ticked", {
  at: Schema.DateTimeUtc,
  nextDue: Schema.DateTimeUtc,
  scheduledFor: Schema.DateTimeUtc,
}) {}

export { Ticked };
