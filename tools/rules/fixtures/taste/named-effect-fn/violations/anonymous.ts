import { Effect } from "effect";

export const loadRoom = Effect.fn(function* (roomId: string) {
  yield* Effect.log(roomId);
});
