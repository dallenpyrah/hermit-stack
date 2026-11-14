import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { NotificationQueued } from "#src/notification/notify/notification-queued.event.js";
import { Notify } from "#src/notification/notify/notify.command.js";
import { DeviceRegistered } from "#src/notification/register-device/device-registered.event.js";
import { RegisterDevice } from "#src/notification/register-device/register-device.command.js";
import { notification, pushed, sam } from "#tests/notification/notification.suite";
import { outboundStory } from "#tests/outbound.suite";

const { then, when } = Story;

type Case = () => ReturnType<typeof outboundStory>;

const token = "device-1";
const next = { ...notification, notificationId: "event-2" };

const pushesToTheDevice: Case = () =>
  outboundStory(
    when(sam, RegisterDevice.make({ token })),
    then(sam, DeviceRegistered.make({ token })),
    when(sam, RegisterDevice.make({ token })),
    then(sam),
    when(sam, Notify.make(notification)),
    then(
      sam,
      NotificationQueued.make({ ...notification, channel: "inbox", to: sam.id }),
      NotificationQueued.make({ ...notification, channel: "push", to: token }),
    ),
    ...pushed({ messageId: "push-1", notificationId: "event-1", token }),
    when(sam, Notify.make(next)),
    then(
      sam,
      NotificationQueued.make({ ...next, channel: "inbox", to: sam.id }),
      NotificationQueued.make({ ...next, channel: "push", to: token }),
    ),
    ...pushed({ messageId: "push-2", notificationId: "event-2", token }),
  );

describe("registering a device", () => {
  it.effect("records a new device once, and push notifications reach it", pushesToTheDevice);
});
