import { DatabaseSync } from "node:sqlite";

import { Database } from "@alchemy.run/better-auth";
import { Effect, Layer } from "effect";

// One connection for the life of the Layer, so an in-memory database keeps its users between requests. Node's own
// SQLite needs no native build, so local runs and tests work on any machine with the pinned Node.
const sqliteDatabase = (filename: string): Layer.Layer<Database> =>
  Layer.effect(
    Database,
    Effect.gen(function* openSqlite() {
      const connection = yield* Effect.acquireRelease(
        Effect.sync(() => new DatabaseSync(filename)),
        (opened) =>
          Effect.sync(() => {
            opened.close();
          }),
      );

      return Database.of({ provider: "sqlite", runtime: Effect.succeed(connection) });
    }),
  );

export { sqliteDatabase };
