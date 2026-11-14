import { Array as Arr, Function as Fn } from "effect";

import type { Channel } from "#src/notification/channel.schema.js";
import type { Muted, RecipientState } from "#src/notification/recipient-state.schema.js";

interface Preference {
  readonly channel: Channel;
  readonly kind: string;
}

const arity = 2;

const mutes: {
  (preference: Preference): (muted: Muted) => boolean;
  (muted: Muted, preference: Preference): boolean;
} = Fn.dual(
  arity,
  (muted: Muted, preference: Preference): boolean =>
    muted.kind === preference.kind && muted.channel === preference.channel,
);

const isMuted: {
  (preference: Preference): (state: RecipientState) => boolean;
  (state: RecipientState, preference: Preference): boolean;
} = Fn.dual(arity, (state: RecipientState, preference: Preference): boolean =>
  Arr.some(state.muted, (muted) => mutes(muted, preference)),
);

export { isMuted, mutes };
