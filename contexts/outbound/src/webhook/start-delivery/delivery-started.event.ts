import { Event } from "@alchemy.run/domain";

import { DeliveryTarget } from "#src/webhook/delivery-target.schema.js";

class DeliveryStarted extends Event("DeliveryStarted", DeliveryTarget.fields) {}

export { DeliveryStarted };
