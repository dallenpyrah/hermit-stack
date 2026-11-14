import { BetterAuth } from "@alchemy.run/better-auth";
import type { BetterAuthProps, Database } from "@alchemy.run/better-auth";
import { RuntimeContext } from "alchemy";
import { Config, Effect, Layer, Option } from "effect";

import { Auth } from "#src/auth.adapter.js";

const authLayer: Layer.Layer<Auth, Config.ConfigError, Database> = Layer.effect(
  Auth,
  Effect.gen(function* authLayer() {
    const secret = yield* Config.Redacted("AUTH_SECRET");
    const baseURL = yield* Config.option(Config.String("AUTH_BASE_URL"));
    const runtime = yield* Effect.context<RuntimeContext>();

    const options: BetterAuthProps = {
      basePath: "/api/auth",
      baseURL: Option.getOrUndefined(baseURL),
      emailAndPassword: { enabled: true },
      secret,
      telemetry: { enabled: false },
    };

    const auth = yield* BetterAuth(options);

    return Auth.of({
      fetch: Effect.provideContext(auth.fetch, runtime),
      getSession: (headers) => Effect.provideContext(auth.getSession(headers), runtime),
      instance: Effect.provideContext(auth.auth, runtime),
    });
  }),
).pipe(Layer.provide(RuntimeContext.phantom));

export { authLayer };
