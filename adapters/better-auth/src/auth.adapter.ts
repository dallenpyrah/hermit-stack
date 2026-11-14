import type { AuthOptions, BetterAuthApiError, BetterAuthProps } from "@alchemy.run/better-auth";
import type { HttpEffect } from "alchemy/Http";
import type { Auth as BetterAuthInstance } from "better-auth";
import { Context } from "effect";
import type { Effect, Scope } from "effect";

// What better-auth knows about a signed-in request. Only these fields cross into the domain.
interface FoundSession {
  readonly user: { readonly id: string; readonly name: string };
}

// Better-auth as one service: fetch is its routes for a server to mount under /api/auth, getSession reads a request's
// Cookie, and instance reaches anything else. A per-execution instance is built on the caller's Scope, as better-auth
// Runs on every host.
class Auth extends Context.Service<
  Auth,
  {
    readonly fetch: HttpEffect;
    readonly getSession: (headers: Headers) => Effect.Effect<FoundSession | null, BetterAuthApiError, Scope.Scope>;
    readonly instance: Effect.Effect<BetterAuthInstance<AuthOptions<BetterAuthProps>>, never, Scope.Scope>;
  }
>()("@repo/better-auth/auth.adapter/Auth") {}

export { Auth };

export type { FoundSession };
