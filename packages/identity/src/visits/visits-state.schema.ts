import { Schema } from "effect";

const VisitsState = Schema.Struct({ name: Schema.String, visits: Schema.Int });

type VisitsState = typeof VisitsState.Type;

export { VisitsState };
