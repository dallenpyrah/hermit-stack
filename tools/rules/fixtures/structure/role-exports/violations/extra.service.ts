import { Context, Effect, Layer } from "effect";

export class RoomLog extends Context.Service<RoomLog, { readonly ping: Effect.Effect<void> }>()("test/RoomLog", {
  make: Effect.succeed({ ping: Effect.void }),
}) {
  public static readonly layer = Layer.effect(this, this.make);
}

export const defaultCapacity = 64;
