import { Context, Effect, Layer } from "effect";

export interface PostedMessage {
  readonly text: string;
}

export type Ping = Effect.Effect<void>;

const trimmed = (text: string): string => text.trim();

export class RoomLog extends Context.Service<RoomLog, { readonly ping: Ping }>()("test/RoomLog", {
  make: Effect.succeed({ ping: Effect.log(trimmed(" ping ")) }),
}) {
  public static readonly layer = Layer.effect(this, this.make);
}
