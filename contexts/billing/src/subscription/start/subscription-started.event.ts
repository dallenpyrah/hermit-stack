import { Event } from "@alchemy.run/domain";

import { Held } from "#src/subscription/processor-report.schema.js";

class SubscriptionStarted extends Event("SubscriptionStarted", Held) {}

export { SubscriptionStarted };
