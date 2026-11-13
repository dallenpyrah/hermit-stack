import { Aggregate } from "@alchemy.run/domain";
import { Array as Arr, Option } from "effect";

import { decideMarkRead, MarkRead } from "#src/notification/mark-read/mark-read.command.js";
import { mutes } from "#src/notification/muted.pure.js";
import { decideNotify, Notify } from "#src/notification/notify/notify.command.js";
import { Muted, RecipientState } from "#src/notification/recipient-state.schema.js";
import { decideRecordDelivery, RecordDelivery } from "#src/notification/record-delivery/record-delivery.command.js";
import { decideRegisterDevice, RegisterDevice } from "#src/notification/register-device/register-device.command.js";
import { decideRemoveDevice, RemoveDevice } from "#src/notification/remove-device/remove-device.command.js";
import { decideSetEmail, SetEmail } from "#src/notification/set-email/set-email.command.js";
import { decideSetPreference, SetPreference } from "#src/notification/set-preference/set-preference.command.js";
import { UserId } from "#src/notification/user.id.js";

// One user as someone to notify. Each command's rule lives in its own file beside its events; this file holds the
// State and how events change it.
class Recipient extends Aggregate(
  "Recipient",
  {
    commands: [SetEmail, RegisterDevice, RemoveDevice, SetPreference, Notify, RecordDelivery, MarkRead],
    decide: {
      MarkRead: (_state, command) => decideMarkRead(command),
      Notify: (state, command, { id }) => decideNotify(state, command, id),
      RecordDelivery: (_state, command) => decideRecordDelivery(command),
      RegisterDevice: decideRegisterDevice,
      RemoveDevice: decideRemoveDevice,
      SetEmail: decideSetEmail,
      SetPreference: decideSetPreference,
    },
    evolve: {
      DeviceRegistered: (state, event) => ({ ...state, devices: [...state.devices, event.token] }),
      DeviceRemoved: (state, event) => ({
        ...state,
        devices: Arr.filter(state.devices, (token) => token !== event.token),
      }),
      EmailSet: (state, event) => ({ ...state, email: Option.some(event.address) }),
      NotificationFailed: (state) => state,
      NotificationQueued: (state) => state,
      NotificationRead: (state) => state,
      NotificationSent: (state) => state,
      PreferenceSet: (state, event) => {
        const others = Arr.filter(state.muted, (muted) => !mutes(muted, event));

        if (event.enabled) {
          return { ...state, muted: others };
        }

        return { ...state, muted: [...others, Muted.make({ channel: event.channel, kind: event.kind })] };
      },
    },
    id: UserId,
    initial: { devices: [], email: Option.none(), muted: [] },
    state: RecipientState,
  },
  { description: "A user as someone to notify: their email address, devices and muted notification kinds." },
) {}

export { Recipient };
