import { Event } from "@alchemy.run/domain";

import { Ended } from "#src/subscription/processor-report.schema.js";

// The processor ended the subscription, at the end of a cancelled period or after its retries ran out.
class SubscriptionCancelled extends Event("SubscriptionCancelled", Ended) {}

export { SubscriptionCancelled };
