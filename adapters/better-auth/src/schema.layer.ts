import { Effect, Layer } from "effect";

import { Auth } from "#src/auth.adapter.js";

// Creates or extends better-auth's tables when the Layer starts. Local runs and tests use it; a deployed target
// Migrates at deploy time through Alchemy instead, so a request never races a schema change.
const schemaLayer: Layer.Layer<never, never, Auth> = Layer.effectDiscard(
  Effect.gen(function* schemaLayer() {
    const auth = yield* Auth;
    const instance = yield* auth.instance;
    const context = yield* Effect.promise(() => instance.$context);

    yield* Effect.promise(() => context.runMigrations());
  }),
);

export { schemaLayer };
