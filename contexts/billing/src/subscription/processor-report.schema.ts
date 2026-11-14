import { Schema } from "effect";

import { PlanId } from "#src/subscription/plan.schema.js";

const Held = {
  payer: Schema.String.annotate({ description: "The processor's reference for the payer, opaque to the model." }),
  periodEnd: Schema.DateTimeUtc,
  plan: PlanId,
  reportedAt: Schema.DateTimeUtc.annotate({ description: "When the processor says this happened." }),
  subscription: Schema.String.annotate({ description: "The processor's reference for the subscription." }),
};

const Ended = {
  payer: Held.payer,
  reportedAt: Held.reportedAt,
  subscription: Held.subscription,
};

type HeldReport = Schema.Struct<typeof Held>["Type"];

type EndedReport = Schema.Struct<typeof Ended>["Type"];

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
