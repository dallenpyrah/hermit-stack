import { Effect } from "effect";

export const loadRoom = Effect.fn(function* () {
  yield* Effect.void;
}, Effect.orDie);
