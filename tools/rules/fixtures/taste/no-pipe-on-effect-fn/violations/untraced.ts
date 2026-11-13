import { Effect } from "effect";

export const loadRoom = Effect.fnUntraced(function* () {
  yield* Effect.void;
}).pipe(Effect.orDie);
