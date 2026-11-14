import { Schema } from "effect";

const Responded = Schema.TaggedStruct("Responded", {
  retryAfterSeconds: Schema.Option(Schema.Int),
  status: Schema.Int,
});

const Unreachable = Schema.TaggedStruct("Unreachable", { reason: Schema.String });

const AttemptOutcome = Schema.Union([Responded, Unreachable]);

export { AttemptOutcome, Responded, Unreachable };
