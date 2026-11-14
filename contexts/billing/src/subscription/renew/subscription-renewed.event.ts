import { Event } from "@alchemy.run/domain";

import { Held } from "#src/subscription/processor-report.schema.js";

class SubscriptionRenewed extends Event("SubscriptionRenewed", Held) {}

export { SubscriptionRenewed };
