import { Event } from "@alchemy.run/domain";

import { Held } from "#src/subscription/processor-report.schema.js";

// A renewal payment failed and the processor will retry it. The subscription is past due, not over.
class PaymentFailed extends Event("PaymentFailed", Held) {}

export { PaymentFailed };
