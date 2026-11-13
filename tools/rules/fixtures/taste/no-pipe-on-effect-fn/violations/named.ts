import { Effect } from "effect";

export const loadRoom = Effect.fn("loadRoom")(function* () {
  yield* Effect.void;
}).pipe(Effect.orDie);
