import { Schema } from "effect";

const RecurringName = Schema.String.pipe(Schema.brand("RecurringName"));

type RecurringName = typeof RecurringName.Type;

export { RecurringName };
