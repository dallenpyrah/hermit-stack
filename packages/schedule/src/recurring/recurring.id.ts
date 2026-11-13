import { Schema } from "effect";

// A stable name, such as close-billing-period, so an Arm sent at every startup reaches the same schedule.
const RecurringName = Schema.String.pipe(Schema.brand("RecurringName"));

type RecurringName = typeof RecurringName.Type;

export { RecurringName };
