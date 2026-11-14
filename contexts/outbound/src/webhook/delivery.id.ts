import { Schema } from "effect";

const DeliveryId = Schema.String.pipe(Schema.brand("DeliveryId"));

type DeliveryId = typeof DeliveryId.Type;

export { DeliveryId };
