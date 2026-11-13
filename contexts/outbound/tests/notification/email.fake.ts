import { Effect, HashMap, Number as Num, Option, Ref } from "effect";

import { Email } from "#src/notification/email.external.js";

// An in-memory email vendor that honours idempotency keys as a real one should: a second send with the same key
// Answers with the first message id and sends nothing.
const EmailFake = Email.toLayer(
  Effect.gen(function* emailFake() {
    const sent = yield* Ref.make(HashMap.empty<string, string>());

    return {
      send: ({ idempotencyKey }): Effect.Effect<{ readonly messageId: string }> =>
        Ref.modify(sent, (byKey) =>
          Option.match(HashMap.get(byKey, idempotencyKey), {
            onNone: () => {
              const messageId = `email-${Num.increment(HashMap.size(byKey))}`;

              return [{ messageId }, HashMap.set(byKey, idempotencyKey, messageId)] as const;
            },
            onSome: (messageId) => [{ messageId }, byKey] as const,
          }),
        ),
    };
  }),
);

export { EmailFake };
