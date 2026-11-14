import { Event } from "@alchemy.run/domain";

import { Ended } from "#src/subscription/processor-report.schema.js";

class SubscriptionCancelled extends Event("SubscriptionCancelled", Ended) {}

export { SubscriptionCancelled };
