import { Effect, Layer, Option } from "effect";

import { CurrentUser } from "@repo/identity/current-user";
import { Session } from "@repo/identity/session";
import { UnauthorizedError } from "@repo/identity/unauthorized";
import { UserId } from "@repo/identity/user-id";

import { Auth } from "#src/auth.adapter.js";

const sessionLayer: Layer.Layer<Session, never, Auth> = Layer.effect(
  Session,
  Effect.gen(function* sessionLayer() {
    const auth = yield* Auth;

    return (effect, { headers }) =>
      Effect.gen(function* session() {
        const found = yield* Effect.orDie(auth.getSession(new globalThis.Headers(headers)));

        return yield* Option.match(Option.fromNullishOr(found), {
          onNone: () => Effect.fail(UnauthorizedError.make()),
          onSome: ({ user }) =>
            Effect.provideService(effect, CurrentUser, { name: user.name, userId: UserId.make(user.id) }),
        });
      });
  }),
);

export { sessionLayer };
