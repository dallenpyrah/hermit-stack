import { Command } from "@alchemy.run/domain";
import { Function as Fn, Option, Schema } from "effect";

import type { RecipientState } from "#src/notification/recipient-state.schema.js";
import { EmailSet } from "#src/notification/set-email/email-set.event.js";
import { UserId } from "#src/notification/user.id.js";

class SetEmail extends Command(
  "SetEmail",
  { events: [EmailSet], input: { address: Schema.String }, target: UserId },
  { description: "Set the address a recipient's email notifications go to." },
) {}

const decideArity = 2;

// Records only a change: setting the address a recipient already has is accepted and records nothing.
const decideSetEmail: {
  (command: SetEmail): (state: RecipientState) => readonly EmailSet[];
  (state: RecipientState, command: SetEmail): readonly EmailSet[];
} = Fn.dual(decideArity, (state: RecipientState, command: SetEmail): readonly EmailSet[] => {
  if (Option.contains(state.email, command.address)) {
    return [];
  }

  return [EmailSet.make({ address: command.address })];
});

export { decideSetEmail, SetEmail };
