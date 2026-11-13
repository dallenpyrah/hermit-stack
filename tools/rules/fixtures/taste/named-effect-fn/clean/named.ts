import { Effect } from "effect";

export const loadRoom = Effect.fn("loadRoom")(function* (roomId: string) {
  yield* Effect.log(roomId);
});
