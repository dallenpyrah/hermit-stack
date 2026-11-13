import { Event } from "@alchemy.run/domain";

import { Held } from "#src/subscription/processor-report.schema.js";

// The processor took a renewal payment, including one it retried after a failure, so the period moves on.
class SubscriptionRenewed extends Event("SubscriptionRenewed", Held) {}

export { SubscriptionRenewed };
