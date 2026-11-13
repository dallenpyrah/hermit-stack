import { Schema } from "effect";

// A plan is named in the app's words, such as "pro". Each processor's adapter maps it to its own price, so the model
// Never holds a processor's catalog id.
const PlanId = Schema.String.pipe(Schema.brand("PlanId"));

type PlanId = typeof PlanId.Type;

export { PlanId };
