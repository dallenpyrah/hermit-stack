import type { AuthOptions, BetterAuthApiError, BetterAuthProps } from "@alchemy.run/better-auth";
import type { HttpEffect } from "alchemy/Http";
import type { Auth as BetterAuthInstance } from "better-auth";
import { Context } from "effect";
import type { Effect, Scope } from "effect";

interface FoundSession {
  readonly user: { readonly id: string; readonly name: string };
}

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
