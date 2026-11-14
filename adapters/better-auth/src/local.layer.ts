import type { Config } from "effect";
import { Layer } from "effect";

import type { Session } from "@repo/identity/session";

import type { Auth } from "#src/auth.adapter.js";
import { authLayer } from "#src/auth.layer.js";
import { schemaLayer } from "#src/schema.layer.js";
import { sessionLayer } from "#src/session.layer.js";
import { sqliteDatabase } from "#src/sqlite.layer.js";

// Better-auth over a SQLite file, or ":memory:", with its tables created at start: what local runs and tests use. A
// Deployed target composes sessionLayer and authLayer with its own database Layer instead.
const localAuth = (filename: string): Layer.Layer<Auth | Session, Config.ConfigError> =>
  Layer.merge(sessionLayer, schemaLayer).pipe(Layer.provideMerge(authLayer), Layer.provide(sqliteDatabase(filename)));

export { localAuth };
