import { Aggregate } from "@alchemy.run/domain";
import { Array as Arr, Match, Option, Schema } from "effect";

import { Channel } from "#src/notification/channel.schema.js";
import {
  DeviceRegistered,
  DeviceRemoved,
  EmailSet,
  MarkRead,
  NotificationFailed,
  NotificationQueued,
  NotificationRead,
  NotificationSent,
  Notify,
  PreferenceSet,
  RecordDelivery,
  RegisterDevice,
  RemoveDevice,
  SetEmail,
  SetPreference,
} from "#src/notification/recipient.command.js";
import { UserId } from "#src/notification/user.id.js";

const Address = Schema.Struct({ channel: Channel, to: Schema.String });

type Address = typeof Address.Type;

const Muted = Schema.Struct({ channel: Channel, kind: Schema.String });

type Muted = typeof Muted.Type;

const RecipientState = Schema.Struct({
  devices: Schema.Array(Schema.String),
  email: Schema.Option(Schema.String),
  muted: Schema.Array(Muted),
});

type RecipientState = typeof RecipientState.Type;

const mutes = (muted: Muted, kind: string, channel: Channel): boolean =>
  muted.kind === kind && muted.channel === channel;

const isMuted = (state: RecipientState, kind: string, channel: Channel): boolean =>
  Arr.some(state.muted, (muted) => mutes(muted, kind, channel));

const addresses = (state: RecipientState, userId: UserId): readonly Address[] => [
  Address.make({ channel: "inbox", to: userId }),
  ...Arr.map(Option.toArray(state.email), (to) => Address.make({ channel: "email", to })),
  ...Arr.map(state.devices, (to) => Address.make({ channel: "push", to })),
];

const notify = (state: RecipientState, command: Notify, userId: UserId): readonly NotificationQueued[] =>
  Arr.map(
    Arr.filter(addresses(state, userId), (address) => !isMuted(state, command.kind, address.channel)),
    (address) =>
      NotificationQueued.make({
        channel: address.channel,
        kind: command.kind,
        notificationId: command.notificationId,
        payload: command.payload,
        to: address.to,
      }),
  );

const recordDelivery = (command: RecordDelivery): readonly (NotificationFailed | NotificationSent)[] => {
  const sent = { channel: command.channel, notificationId: command.notificationId, to: command.to };

  return Match.valueTags(command.result, {
    Accepted: (accepted) => [NotificationSent.make({ ...sent, messageId: accepted.messageId })],
    Refused: (refused) => [NotificationFailed.make({ ...sent, reason: refused.reason })],
  });
};

// Records only a change: turning on what is on, or off what is off, is accepted and records nothing.
const setPreference = (state: RecipientState, command: SetPreference): readonly PreferenceSet[] => {
  if (isMuted(state, command.kind, command.channel) !== command.enabled) {
    return [];
  }

  return [PreferenceSet.make({ channel: command.channel, enabled: command.enabled, kind: command.kind })];
};

const setEmail = (state: RecipientState, command: SetEmail): readonly EmailSet[] => {
  if (Option.contains(state.email, command.address)) {
    return [];
  }

  return [EmailSet.make({ address: command.address })];
};

const applyPreference = (state: RecipientState, event: PreferenceSet): RecipientState => {
  const others = Arr.filter(state.muted, (muted) => !mutes(muted, event.kind, event.channel));

  if (event.enabled) {
    return { ...state, muted: others };
  }

  return { ...state, muted: [...others, Muted.make({ channel: event.channel, kind: event.kind })] };
};

// One user as someone to notify: where they can be reached and what they turned off. Quiet hours and digests are not
// Modelled yet.
class Recipient extends Aggregate(
  "Recipient",
  {
    commands: [SetEmail, RegisterDevice, RemoveDevice, SetPreference, Notify, RecordDelivery, MarkRead],
    decide: {
      MarkRead: (_state, command) => [NotificationRead.make({ notificationId: command.notificationId })],
      Notify: (state, command, { id }) => notify(state, command, id),
      RecordDelivery: (_state, command) => recordDelivery(command),
      RegisterDevice: (state, command) =>
        Arr.map(
          Arr.filter([command.token], (token) => !Arr.contains(state.devices, token)),
          (token) => DeviceRegistered.make({ token }),
        ),
      RemoveDevice: (state, command) =>
        Arr.map(
          Arr.filter([command.token], (token) => Arr.contains(state.devices, token)),
          (token) => DeviceRemoved.make({ token }),
        ),
      SetEmail: (state, command) => setEmail(state, command),
      SetPreference: (state, command) => setPreference(state, command),
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
      PreferenceSet: applyPreference,
    },
    id: UserId,
    initial: { devices: [], email: Option.none(), muted: [] },
    state: RecipientState,
  },
  { description: "A user as someone to notify: their email address, devices and muted notification kinds." },
) {}

export { Recipient };
