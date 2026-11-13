import { Schema } from "effect";

// <endpointId>:<eventId>, so one public event reaches one endpoint through one delivery however often it is started.
const DeliveryId = Schema.String.pipe(Schema.brand("DeliveryId"));

type DeliveryId = typeof DeliveryId.Type;

export { DeliveryId };
