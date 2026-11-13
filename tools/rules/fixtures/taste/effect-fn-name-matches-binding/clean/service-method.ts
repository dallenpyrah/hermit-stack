import { Effect } from "effect";

export const make = Effect.gen(function* () {
  const query = Effect.fn("Database.query")(function* (sql: string) {
    yield* Effect.log(sql);
  });
  return { query };
});
