import { it } from "@effect/vitest";
import { Array as Arr, ConfigProvider, DateTime, Effect, Layer, Number as Num, Ref, String as Str } from "effect";
import { Cookies } from "effect/http";

import { SessionAdapter } from "@repo/identity/session-adapter";
import type { SignedIn } from "@repo/identity/session-adapter";
import { sessionContract, sessionTarget } from "@repo/identity/session-contract";
import { UserId } from "@repo/identity/user-id";

import { Auth } from "#src/auth.adapter.js";
import { localAuth } from "#src/local.layer.js";

const password = "correct-horse-battery-staple";

const noneYet = 0;

// Long ago enough that every clock agrees the session is over.
const longAgo = DateTime.toDateUtc(DateTime.makeUnsafe("2000-01-01T00:00:00Z"));

// The settings a deployment reads from its environment, fixed for the test.
const testConfig = ConfigProvider.fromUnknown({
  AUTH_BASE_URL: "http://localhost:3000",
  AUTH_SECRET: "test-only-secret-test-only-secret-test-only",
});

// Signs each user up and then in through better-auth's own endpoints, against the SQLite database, and hands the
// Contract the cookie a browser would send. Expiring a session moves its expiry into the past in the database, as time
// Passing would.
const betterAuthHarness = Layer.effect(
  SessionAdapter,
  Effect.gen(function* betterAuthHarness() {
    const auth = yield* Auth;
    const signedUp = yield* Ref.make(noneYet);

    const signUp = Effect.fn("signUp")(function* signUp(name: string) {
      const instance = yield* auth.instance;
      const count = yield* Ref.updateAndGet(signedUp, Num.increment);
      const email = `${Str.toLowerCase(name)}-${count}@example.com`;

      const user = yield* Effect.promise(() => instance.api.signUpEmail({ body: { email, name, password } }));

      const signIn = yield* Effect.promise(() =>
        instance.api.signInEmail({ asResponse: true, body: { email, password } }),
      );

      const cookie = Cookies.toCookieHeader(Cookies.fromSetCookie(signIn.headers.getSetCookie()));

      return { headers: { cookie }, userId: UserId.make(user.user.id) };
    }, Effect.scoped);

    const expire = Effect.fn("expire")(function* expire({ userId }: SignedIn) {
      const instance = yield* auth.instance;
      const context = yield* Effect.promise(() => instance.$context);
      const sessions = yield* Effect.promise(() => context.internalAdapter.listSessions(userId));

      yield* Effect.forEach(
        Arr.map(sessions, (session) => session.token),
        (token) => Effect.promise(() => context.internalAdapter.updateSession(token, { expiresAt: longAgo })),
        { concurrency: 1 },
      );
    }, Effect.scoped);

    return SessionAdapter.of({ expire, signUp });
  }),
);

const betterAuth = betterAuthHarness.pipe(
  Layer.provideMerge(localAuth(":memory:")),
  Layer.provide(ConfigProvider.layer(testConfig)),
);

it.layer(sessionTarget(betterAuth))("the Session port, adapted by better-auth over SQLite", sessionContract);
