import { Schema } from "effect";

import { PlanId } from "#src/subscription/plan.schema.js";

// What the processor reports about a subscription it still holds. Every report carries the whole picture, not a
// Change, so the newest report alone decides the state and reports may arrive in any order.
const Held = {
  payer: Schema.String.annotate({ description: "The processor's reference for the payer, opaque to the model." }),
  periodEnd: Schema.DateTimeUtc,
  plan: PlanId,
  reportedAt: Schema.DateTimeUtc.annotate({ description: "When the processor says this happened." }),
  subscription: Schema.String.annotate({ description: "The processor's reference for the subscription." }),
};

// A subscription the processor has ended has no plan or period left to report.
const Ended = {
  payer: Held.payer,
  reportedAt: Held.reportedAt,
  subscription: Held.subscription,
};

type HeldReport = Schema.Struct<typeof Held>["Type"];

type EndedReport = Schema.Struct<typeof Ended>["Type"];

// Copies a report's fields out of the command that carried it, leaving the command's tag behind.
const heldOf = (report: HeldReport): HeldReport => ({
  payer: report.payer,
  periodEnd: report.periodEnd,
  plan: report.plan,
  reportedAt: report.reportedAt,
  subscription: report.subscription,
});

const endedOf = (report: EndedReport): EndedReport => ({
  payer: report.payer,
  reportedAt: report.reportedAt,
  subscription: report.subscription,
});

export { Ended, endedOf, Held, heldOf };

export type { EndedReport, HeldReport };
