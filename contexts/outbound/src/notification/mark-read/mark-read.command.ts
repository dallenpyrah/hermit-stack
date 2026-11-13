import { Command } from "@alchemy.run/domain";
import { Schema } from "effect";

import { NotificationRead } from "#src/notification/mark-read/notification-read.event.js";
import { UserId } from "#src/notification/user.id.js";

class MarkRead extends Command(
  "MarkRead",
  { events: [NotificationRead], input: { notificationId: Schema.String }, target: UserId },
  { description: "Mark a notification in the inbox as read." },
) {}

// Reading is recorded every time; the Inbox view counts a notification as read once.
const decideMarkRead = (command: MarkRead): readonly NotificationRead[] => [
  NotificationRead.make({ notificationId: command.notificationId }),
];

export { decideMarkRead, MarkRead };
