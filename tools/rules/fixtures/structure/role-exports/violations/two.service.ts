import { Context, Effect, Layer } from "effect";

export class First extends Context.Service<First, { readonly ping: Effect.Effect<void> }>()("test/First", {
  make: Effect.succeed({ ping: Effect.void }),
}) {
  public static readonly layer = Layer.effect(this, this.make);
}

export class Second extends Context.Service<Second, { readonly ping: Effect.Effect<void> }>()("test/Second", {
  make: Effect.succeed({ ping: Effect.void }),
}) {}
