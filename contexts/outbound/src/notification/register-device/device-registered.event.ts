import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class DeviceRegistered extends Event("DeviceRegistered", { token: Schema.String }) {}

export { DeviceRegistered };
