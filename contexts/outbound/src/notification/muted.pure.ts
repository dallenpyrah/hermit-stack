import { Array as Arr, Function as Fn } from "effect";

import type { Channel } from "#src/notification/channel.schema.js";
import type { Muted, RecipientState } from "#src/notification/recipient-state.schema.js";

interface Preference {
  readonly channel: Channel;
  readonly kind: string;
}

const arity = 2;

const mutedFor = (muted: Muted, preference: Preference): boolean =>
  muted.kind === preference.kind && muted.channel === preference.channel;

const mutes: {
  (preference: Preference): (muted: Muted) => boolean;
  (muted: Muted, preference: Preference): boolean;
} = Fn.dual(arity, mutedFor);

const anyMutes = (state: RecipientState, preference: Preference): boolean =>
  Arr.some(state.muted, (muted) => mutedFor(muted, preference));

const isMuted: {
  (preference: Preference): (state: RecipientState) => boolean;
  (state: RecipientState, preference: Preference): boolean;
} = Fn.dual(arity, anyMutes);

export { isMuted, mutes };
