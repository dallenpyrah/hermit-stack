import { Command } from "@alchemy.run/domain";
import { Match } from "effect";

import { DeliveryResult, NotificationAddress } from "#src/notification/record-delivery/delivery-result.schema.js";
import { NotificationFailed } from "#src/notification/record-delivery/notification-failed.event.js";
import { NotificationSent } from "#src/notification/record-delivery/notification-sent.event.js";
import { UserId } from "#src/notification/user.id.js";

// Reports what the vendor said, so it never rejects; the vendor's message id lets a later bounce find the notification.
class RecordDelivery extends Command(
  "RecordDelivery",
  {
    events: [NotificationSent, NotificationFailed],
    input: { ...NotificationAddress.fields, result: DeliveryResult },
    target: UserId,
  },
  { description: "Record what the email or push vendor answered for one notification." },
) {}

const decideRecordDelivery = (command: RecordDelivery): readonly (NotificationFailed | NotificationSent)[] => {
  const sent = { channel: command.channel, notificationId: command.notificationId, to: command.to };

  return Match.valueTags(command.result, {
    Accepted: (accepted) => [NotificationSent.make({ ...sent, messageId: accepted.messageId })],
    Refused: (refused) => [NotificationFailed.make({ ...sent, reason: refused.reason })],
  });
};

export { decideRecordDelivery, RecordDelivery };
