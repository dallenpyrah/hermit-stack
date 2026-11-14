import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { NotificationQueued } from "#src/notification/notify/notification-queued.event.js";
import { Notify } from "#src/notification/notify/notify.command.js";
import { DeviceGone, Push } from "#src/notification/push.external.js";
import { NotificationFailed } from "#src/notification/record-delivery/notification-failed.event.js";
import { DeviceRegistered } from "#src/notification/register-device/device-registered.event.js";
import { notification, pushed, sam } from "#tests/notification/notification.suite";
import { outboundStory } from "#tests/outbound.suite";

const { call, fail, given, then, when } = Story;

type Case = () => ReturnType<typeof outboundStory>;

const token = "device-1";
const next = { ...notification, notificationId: "event-2" };

const recordsARefusal: Case = () =>
  outboundStory(
    given(sam, DeviceRegistered.make({ token })),
    when(sam, Notify.make(notification)),
    then(
      sam,
      NotificationQueued.make({ ...notification, channel: "inbox", to: sam.id }),
      NotificationQueued.make({ ...notification, channel: "push", to: token }),
    ),
    call(Push.send, { token }),
    fail(Push.send, DeviceGone.make({ reason: "unregistered" })),
    then(
      sam,
      NotificationFailed.make({ channel: "push", notificationId: "event-1", reason: "unregistered", to: token }),
    ),
    when(sam, Notify.make(next)),
    then(
      sam,
      NotificationQueued.make({ ...next, channel: "inbox", to: sam.id }),
      NotificationQueued.make({ ...next, channel: "push", to: token }),
    ),
    ...pushed({ messageId: "push-2", notificationId: "event-2", token }),
  );

describe("recording what the vendor answered", () => {
  it.effect("records a refused push with the vendor's reason and changes nothing else", recordsARefusal);
});
