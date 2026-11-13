import { Effect } from "effect";

export const loadRoom = Effect.fn("fetchRoom")(function* () {
  yield* Effect.void;
});
