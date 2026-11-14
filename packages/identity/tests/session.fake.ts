import { Context, Effect, HashMap, Layer, Option, Random, Ref, String as Str, pipe } from "effect";
import type { Record as Rec } from "effect";
import { Headers } from "effect/http";

import { CurrentUser } from "#src/current-user.context.js";
import { Session } from "#src/session.middleware.js";
import { SessionAdapter } from "#src/session-adapter.service.js";
import { UnauthorizedError } from "#src/unauthorized.rejection.js";
import { UserId } from "#src/user.id.js";

const scheme = "Fake ";

const tokenOf = (headers: Headers.Headers): Option.Option<string> =>
  pipe(
    Headers.get(headers, "authorization"),
    Option.filter(Str.startsWith(scheme)),
    Option.map(Str.slice(scheme.length)),
  );

type Sessions = Ref.Ref<HashMap.HashMap<string, CurrentUser["Service"]>>;

const sessionFrom =
  (sessions: Sessions): Session["Service"] =>
  (effect, { headers }) =>
    Effect.flatMap(Ref.get(sessions), (held) =>
      Option.match(
        Option.flatMap(tokenOf(headers), (token) => HashMap.get(held, token)),
        {
          onNone: () => Effect.fail(UnauthorizedError.make()),
          onSome: (user) => Effect.provideService(effect, CurrentUser, user),
        },
      ),
    );

const adapterFrom = (sessions: Sessions): SessionAdapter["Service"] => ({
  expire: ({ headers }: { readonly headers: Rec.ReadonlyRecord<string, string> }) =>
    Option.match(tokenOf(Headers.fromInput(headers)), {
      onNone: () => Effect.void,
      onSome: (token) => Ref.update(sessions, HashMap.remove(token)),
    }),
  signUp: Effect.fn("signUp")(function* signUp(name: string) {
    const token = `${yield* Random.nextInt}`;
    const userId = UserId.make(`fake-${token}`);

    yield* Ref.update(sessions, HashMap.set(token, { name, userId }));

    return { headers: { authorization: `${scheme}${token}` }, userId };
  }),
});

// Sessions are opaque tokens held in memory, so the fake refuses an unknown, altered or expired token the way a real
// Adapter does, and a test of a command that lists Session runs without an auth vendor. The adapter assigns each id.
const SessionFake: Layer.Layer<Session | SessionAdapter> = Layer.effectContext(
  Effect.gen(function* sessionFake() {
    const sessions: Sessions = yield* Ref.make(HashMap.empty<string, CurrentUser["Service"]>());
    const session = Context.make(Session, sessionFrom(sessions));

    return Context.add(session, SessionAdapter, adapterFrom(sessions));
  }),
);

export { SessionFake };
