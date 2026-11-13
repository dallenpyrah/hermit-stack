import { Effect } from "effect";

export const loadAll = (ids: ReadonlyArray<string>, load: (id: string) => Effect.Effect<string>) =>
  Effect.all(ids.map(load), { concurrency: "inherit" });
