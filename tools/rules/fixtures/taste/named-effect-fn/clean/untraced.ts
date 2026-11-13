import { Effect } from "effect";

export const clampSize = Effect.fnUntraced(function* (size: number) {
  return Math.max(size, 1);
});
