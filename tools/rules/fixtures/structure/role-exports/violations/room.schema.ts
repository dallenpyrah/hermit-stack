import { Context, Effect, Layer } from "effect";

export class RoomRules extends Context.Service<RoomRules, { readonly ping: Effect.Effect<void> }>()("test/RoomRules", {
  make: Effect.succeed({ ping: Effect.void }),
}) {
  public static readonly layer = Layer.effect(this, this.make);
}
