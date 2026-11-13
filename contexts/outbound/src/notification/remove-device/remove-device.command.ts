import { Command } from "@alchemy.run/domain";
import { Array as Arr, Function as Fn, Schema } from "effect";

import type { RecipientState } from "#src/notification/recipient-state.schema.js";
import { DeviceRemoved } from "#src/notification/remove-device/device-removed.event.js";
import { UserId } from "#src/notification/user.id.js";

// Also what a push vendor's invalid-token callback turns into, so a dead device stops receiving.
class RemoveDevice extends Command(
  "RemoveDevice",
  { events: [DeviceRemoved], input: { token: Schema.String }, target: UserId },
  { description: "Stop sending push notifications to a device." },
) {}

const decideArity = 2;

// Removing a device the recipient does not have records nothing.
const decideRemoveDevice: {
  (command: RemoveDevice): (state: RecipientState) => readonly DeviceRemoved[];
  (state: RecipientState, command: RemoveDevice): readonly DeviceRemoved[];
} = Fn.dual(decideArity, (state: RecipientState, command: RemoveDevice): readonly DeviceRemoved[] =>
  Arr.map(
    Arr.filter([command.token], (token) => Arr.contains(state.devices, token)),
    (token) => DeviceRemoved.make({ token }),
  ),
);

export { decideRemoveDevice, RemoveDevice };
