import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class DeviceRemoved extends Event("DeviceRemoved", { token: Schema.String }) {}

export { DeviceRemoved };
