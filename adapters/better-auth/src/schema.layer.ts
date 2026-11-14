import { Effect, Layer } from "effect";

import { Auth } from "#src/auth.adapter.js";

const schemaLayer: Layer.Layer<never, never, Auth> = Layer.effectDiscard(
  Effect.gen(function* schemaLayer() {
    const auth = yield* Auth;
    const instance = yield* auth.instance;
    const context = yield* Effect.promise(() => instance.$context);

    yield* Effect.promise(() => context.runMigrations());
  }),
);

export { schemaLayer };
