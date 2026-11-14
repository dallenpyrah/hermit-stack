import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class NotificationRead extends Event("NotificationRead", { notificationId: Schema.String }) {}

export { NotificationRead };
