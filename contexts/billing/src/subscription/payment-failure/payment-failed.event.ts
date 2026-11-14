import { Event } from "@alchemy.run/domain";

import { Held } from "#src/subscription/processor-report.schema.js";

class PaymentFailed extends Event("PaymentFailed", Held) {}

export { PaymentFailed };
