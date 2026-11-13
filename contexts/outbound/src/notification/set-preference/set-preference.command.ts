import { Command } from "@alchemy.run/domain";
import { Function as Fn, Schema } from "effect";

import { Channel } from "#src/notification/channel.schema.js";
import { isMuted } from "#src/notification/muted.pure.js";
import type { RecipientState } from "#src/notification/recipient-state.schema.js";
import { PreferenceSet } from "#src/notification/set-preference/preference-set.event.js";
import { UserId } from "#src/notification/user.id.js";

// Every kind reaches every channel until the recipient turns one off, so a new kind needs no migration.
class SetPreference extends Command(
  "SetPreference",
  {
    events: [PreferenceSet],
    input: { channel: Channel, enabled: Schema.Boolean, kind: Schema.String },
    target: UserId,
  },
  { description: "Turn one kind of notification on or off for one channel." },
) {}

const decideArity = 2;

// Records only a change: turning on what is on, or off what is off, is accepted and records nothing.
const decideSetPreference: {
  (command: SetPreference): (state: RecipientState) => readonly PreferenceSet[];
  (state: RecipientState, command: SetPreference): readonly PreferenceSet[];
} = Fn.dual(decideArity, (state: RecipientState, command: SetPreference): readonly PreferenceSet[] => {
  if (isMuted(state, command) !== command.enabled) {
    return [];
  }

  return [PreferenceSet.make({ channel: command.channel, enabled: command.enabled, kind: command.kind })];
});

export { decideSetPreference, SetPreference };
