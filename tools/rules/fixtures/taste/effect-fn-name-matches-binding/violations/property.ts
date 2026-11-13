import { Effect } from "effect";

export const rooms = {
  join: Effect.fn("Rooms.enter")(function* () {
    yield* Effect.void;
  }),
};
