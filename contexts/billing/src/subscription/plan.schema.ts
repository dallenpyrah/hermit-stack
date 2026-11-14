import { Schema } from "effect";

const PlanId = Schema.String.pipe(Schema.brand("PlanId"));

type PlanId = typeof PlanId.Type;

export { PlanId };
