import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { NotificationQueued } from "#src/notification/notify/notification-queued.event.js";
import { Notify } from "#src/notification/notify/notify.command.js";
import { DeviceRegistered } from "#src/notification/register-device/device-registered.event.js";
import { DeviceRemoved } from "#src/notification/remove-device/device-removed.event.js";
import { RemoveDevice } from "#src/notification/remove-device/remove-device.command.js";
import { notification, pushed, sam } from "#tests/notification/notification.suite";
import { outboundStory } from "#tests/outbound.suite";

const { given, then, when } = Story;

type Case = () => ReturnType<typeof outboundStory>;

const phone = "device-1";
const tablet = "device-2";

const stopsPushingToTheDevice: Case = () =>
  outboundStory(
    given(sam, DeviceRegistered.make({ token: phone }), DeviceRegistered.make({ token: tablet })),
    when(sam, RemoveDevice.make({ token: phone })),
    then(sam, DeviceRemoved.make({ token: phone })),
    when(sam, RemoveDevice.make({ token: phone })),
    then(sam),
    when(sam, Notify.make(notification)),
    then(
      sam,
      NotificationQueued.make({ ...notification, channel: "inbox", to: sam.id }),
      NotificationQueued.make({ ...notification, channel: "push", to: tablet }),
    ),
    ...pushed({ messageId: "push-1", notificationId: "event-1", token: tablet }),
  );

describe("removing a device", () => {
  it.effect("records a removal once, and push notifications stop reaching it", stopsPushingToTheDevice);
});
