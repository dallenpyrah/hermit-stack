import { Schema } from "effect";

// The receiver answered with a status, and maybe a retry-after in seconds; or no answer came at all.
const Responded = Schema.TaggedStruct("Responded", {
  retryAfterSeconds: Schema.Option(Schema.Int),
  status: Schema.Int,
});

const Unreachable = Schema.TaggedStruct("Unreachable", { reason: Schema.String });

const AttemptOutcome = Schema.Union([Responded, Unreachable]);

export { AttemptOutcome, Responded, Unreachable };
