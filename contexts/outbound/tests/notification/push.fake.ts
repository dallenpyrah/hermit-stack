import type { Identifier } from "@alchemy.run/domain/ExternalSystem";
import { Context, Effect, HashMap, HashSet, Layer, Number as Num, Option, Ref } from "effect";

import { DeviceGone, Push } from "#src/notification/push.external.js";

interface ShownNotification {
  readonly body: string;
  readonly title: string;
}

// What a test sees and controls of the push vendor behind the Push port. The fake below provides it, and so does each
// Adapter's local stand-in for its real vendor, so one contract suite runs against all of them.
class PushVendor extends Context.Service<
  PushVendor,
  {
    // The vendor forgets the device, as it does once the app is uninstalled.
    readonly forget: (token: string) => Effect.Effect<void>;
    // A token for a new device the vendor knows, on which nothing has been shown yet.
    readonly register: Effect.Effect<string>;
    // The notifications the device shows, oldest first.
    readonly shownOn: (token: string) => Effect.Effect<readonly ShownNotification[]>;
    // From now on the vendor takes each request to this device and never answers it.
    readonly stopAnsweringFor: (token: string) => Effect.Effect<void>;
  }
>()("@repo/outbound/tests/notification/push.fake/PushVendor") {}

interface Devices {
  readonly issued: number;
  readonly byKey: HashMap.HashMap<string, string>;
  readonly known: HashMap.HashMap<string, readonly ShownNotification[]>;
  readonly silent: HashSet.HashSet<string>;
}

interface Send extends ShownNotification {
  readonly idempotencyKey: string;
  readonly token: string;
}

const show = (devices: Devices, { body, idempotencyKey, title, token }: Send): readonly [string, Devices] =>
  Option.match(HashMap.get(devices.byKey, idempotencyKey), {
    onNone: () => {
      const messageId = `push-${Num.increment(HashMap.size(devices.byKey))}`;
      const byKey = HashMap.set(devices.byKey, idempotencyKey, messageId);
      const known = HashMap.modify(devices.known, token, (shown) => [...shown, { body, title }]);

      return [messageId, { ...devices, byKey, known }];
    },
    onSome: (messageId) => [messageId, devices],
  });

// An in-memory push vendor in which a repeated idempotency key shows the device nothing new and answers with the
// First message id. A device the vendor does not know is gone, and a send the vendor never answers fails as a defect,
// The way an adapter gives up after its timeout.
const push = (devices: Ref.Ref<Devices>): Layer.Layer<Identifier<typeof Push>> =>
  Push.toLayer(
    Effect.succeed({
      send: Effect.fn("PushFake.send")(function* send(args) {
        const { known, silent } = yield* Ref.get(devices);

        if (HashSet.has(silent, args.token)) {
          return yield* Effect.die(new Error("The push vendor did not answer before the timeout."));
        }

        if (!HashMap.has(known, args.token)) {
          return yield* Effect.fail(DeviceGone.make({ reason: "The vendor does not know this device." }));
        }

        const messageId = yield* Ref.modify(devices, (state) => show(state, args));

        return { messageId };
      }),
    }),
  );

const vendor = (devices: Ref.Ref<Devices>): Layer.Layer<PushVendor> =>
  Layer.succeed(PushVendor, {
    forget: (token) => Ref.update(devices, (state) => ({ ...state, known: HashMap.remove(state.known, token) })),
    register: Ref.modify(devices, (state) => {
      const issued = Num.increment(state.issued);
      const token = `device-${issued}`;

      return [token, { ...state, issued, known: HashMap.set(state.known, token, []) }];
    }),
    shownOn: (token) =>
      Effect.map(Ref.get(devices), (state) => Option.getOrElse(HashMap.get(state.known, token), () => [])),
    stopAnsweringFor: (token) =>
      Ref.update(devices, (state) => ({ ...state, silent: HashSet.add(state.silent, token) })),
  });

const noDevices: Devices = { byKey: HashMap.empty(), issued: 0, known: HashMap.empty(), silent: HashSet.empty() };

const PushFake = Layer.unwrap(
  Effect.map(Ref.make(noDevices), (devices) => Layer.mergeAll(push(devices), vendor(devices))),
);

export { PushFake, PushVendor };
