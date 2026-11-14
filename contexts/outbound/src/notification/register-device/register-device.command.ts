import { Command } from "@alchemy.run/domain";
import { Array as Arr, Function as Fn, Schema } from "effect";

import type { RecipientState } from "#src/notification/recipient-state.schema.js";
import { DeviceRegistered } from "#src/notification/register-device/device-registered.event.js";
import { UserId } from "#src/notification/user.id.js";

class RegisterDevice extends Command(
  "RegisterDevice",
  { events: [DeviceRegistered], input: { token: Schema.String }, target: UserId },
  { description: "Add a device that receives a recipient's push notifications." },
) {}

const decideArity = 2;

const decideRegisterDevice: {
  (command: RegisterDevice): (state: RecipientState) => readonly DeviceRegistered[];
  (state: RecipientState, command: RegisterDevice): readonly DeviceRegistered[];
} = Fn.dual(decideArity, (state: RecipientState, command: RegisterDevice): readonly DeviceRegistered[] =>
  Arr.map(
    Arr.filter([command.token], (token) => !Arr.contains(state.devices, token)),
    (token) => DeviceRegistered.make({ token }),
  ),
);

export { decideRegisterDevice, RegisterDevice };
