import { Schema } from "effect";

import { DeliveryTarget } from "#src/webhook/delivery-target.schema.js";

const DeliveryOutcome = Schema.Literals(["delivered", "exhausted", "gone"]);

type DeliveryOutcome = typeof DeliveryOutcome.Type;

const Fresh = Schema.TaggedStruct("Fresh", {});

const Posting = Schema.TaggedStruct("Posting", { ...DeliveryTarget.fields, attempt: Schema.Int });

const Waiting = Schema.TaggedStruct("Waiting", { ...DeliveryTarget.fields, attempt: Schema.Int });

const Settled = Schema.TaggedStruct("Settled", {
  ...DeliveryTarget.fields,
  attempts: Schema.Int,
  outcome: DeliveryOutcome,
});

const DeliveryState = Schema.Union([Fresh, Posting, Waiting, Settled]);

type DeliveryState = typeof DeliveryState.Type;

type PostingState = typeof Posting.Type;

export { DeliveryOutcome, DeliveryState, Fresh, Posting, Settled, Waiting };

export type { PostingState };
