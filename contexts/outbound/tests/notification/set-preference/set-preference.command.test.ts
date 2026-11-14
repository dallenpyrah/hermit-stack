import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { NotificationQueued } from "#src/notification/notify/notification-queued.event.js";
import { Notify } from "#src/notification/notify/notify.command.js";
import { PreferenceSet } from "#src/notification/set-preference/preference-set.event.js";
import { SetPreference } from "#src/notification/set-preference/set-preference.command.js";
import { sam } from "#tests/notification/notification.suite";
import { outboundStory } from "#tests/outbound.suite";

const { then, when } = Story;

type Case = () => ReturnType<typeof outboundStory>;

const paid = { kind: "invoice.paid", notificationId: "event-1", payload: { invoiceId: "invoice-7" } };

const overdue = { kind: "invoice.overdue", notificationId: "event-2", payload: { invoiceId: "invoice-8" } };

const muteInboxPaid = SetPreference.make({ channel: "inbox", enabled: false, kind: "invoice.paid" });
const unmuteInboxPaid = SetPreference.make({ channel: "inbox", enabled: true, kind: "invoice.paid" });

const mutesOneKindOnOneChannel: Case = () =>
  outboundStory(
    when(sam, unmuteInboxPaid),
    then(sam),
    when(sam, muteInboxPaid),
    then(sam, PreferenceSet.make({ channel: "inbox", enabled: false, kind: "invoice.paid" })),
    when(sam, muteInboxPaid),
    then(sam),
    when(sam, Notify.make(paid)),
    then(sam),
    when(sam, Notify.make(overdue)),
    then(sam, NotificationQueued.make({ ...overdue, channel: "inbox", to: sam.id })),
    when(sam, SetPreference.make({ channel: "push", enabled: false, kind: "invoice.overdue" })),
    then(sam, PreferenceSet.make({ channel: "push", enabled: false, kind: "invoice.overdue" })),
    when(sam, Notify.make({ ...overdue, notificationId: "event-3" })),
    then(sam, NotificationQueued.make({ ...overdue, channel: "inbox", notificationId: "event-3", to: sam.id })),
    when(sam, unmuteInboxPaid),
    then(sam, PreferenceSet.make({ channel: "inbox", enabled: true, kind: "invoice.paid" })),
    when(sam, unmuteInboxPaid),
    then(sam),
    when(sam, Notify.make({ ...paid, notificationId: "event-4" })),
    then(sam, NotificationQueued.make({ ...paid, channel: "inbox", notificationId: "event-4", to: sam.id })),
  );

describe("setting a notification preference", () => {
  it.effect("turns one kind off on one channel until it is turned on again", mutesOneKindOnOneChannel);
});
