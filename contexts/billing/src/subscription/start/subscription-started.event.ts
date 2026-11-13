import { Event } from "@alchemy.run/domain";

import { Held } from "#src/subscription/processor-report.schema.js";

// The processor took the first payment, so the customer may use the plan until the period ends.
class SubscriptionStarted extends Event("SubscriptionStarted", Held) {}

export { SubscriptionStarted };
