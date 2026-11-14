import type { Identifier } from "@alchemy.run/domain/ExternalSystem";
import { Array as Arr, Context, Effect, HashMap, HashSet, Layer, Number as Num, Option, Ref } from "effect";

import { Email, Undeliverable } from "#src/notification/email.external.js";

interface DeliveredEmail {
  readonly subject: string;
  readonly text: string;
}

class EmailVendor extends Context.Service<
  EmailVendor,
  {
    readonly deliveredTo: (address: string) => Effect.Effect<readonly DeliveredEmail[]>;
    readonly stopAnsweringFor: (address: string) => Effect.Effect<void>;
  }
>()("@repo/outbound/tests/notification/email.fake/EmailVendor") {}

interface Outbox {
  readonly byKey: HashMap.HashMap<string, string>;
  readonly delivered: readonly (DeliveredEmail & { readonly to: string })[];
  readonly silent: HashSet.HashSet<string>;
}

const address = /^[^\s@]+@[^\s@]+$/u;

const deliver = (
  state: Outbox,
  { idempotencyKey, subject, text, to }: DeliveredEmail & { readonly idempotencyKey: string; readonly to: string },
): readonly [{ readonly messageId: string }, Outbox] =>
  Option.match(HashMap.get(state.byKey, idempotencyKey), {
    onNone: () => {
      const messageId = `email-${Num.increment(HashMap.size(state.byKey))}`;
      const byKey = HashMap.set(state.byKey, idempotencyKey, messageId);

      return [{ messageId }, { ...state, byKey, delivered: [...state.delivered, { subject, text, to }] }];
    },
    onSome: (messageId) => [{ messageId }, state],
  });

const email = (outbox: Ref.Ref<Outbox>): Layer.Layer<Identifier<typeof Email>> =>
  Email.toLayer(
    Effect.succeed({
      send: Effect.fn("EmailFake.send")(function* send(args) {
        const { silent } = yield* Ref.get(outbox);

        if (HashSet.has(silent, args.to)) {
          return yield* Effect.die(new Error("The email vendor did not answer before the timeout."));
        }

        if (!address.test(args.to)) {
          return yield* Effect.fail(Undeliverable.make({ reason: `${args.to} is not an email address.` }));
        }

        return yield* Ref.modify(outbox, (state) => deliver(state, args));
      }),
    }),
  );

const vendor = (outbox: Ref.Ref<Outbox>): Layer.Layer<EmailVendor> =>
  Layer.succeed(EmailVendor, {
    deliveredTo: (to) =>
      Effect.map(Ref.get(outbox), (state) =>
        Arr.map(
          Arr.filter(state.delivered, (sent) => sent.to === to),
          (sent) => ({ subject: sent.subject, text: sent.text }),
        ),
      ),
    stopAnsweringFor: (to) => Ref.update(outbox, (state) => ({ ...state, silent: HashSet.add(state.silent, to) })),
  });

const emptyOutbox: Outbox = { byKey: HashMap.empty(), delivered: [], silent: HashSet.empty() };

const EmailFake = Layer.unwrap(
  Effect.map(Ref.make(emptyOutbox), (outbox) => Layer.mergeAll(email(outbox), vendor(outbox))),
);

export { EmailFake, EmailVendor };
