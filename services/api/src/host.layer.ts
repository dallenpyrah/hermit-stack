import { InMemory } from "@alchemy.run/domain";
import type { Platform } from "@alchemy.run/domain";
import { Config, Effect, Layer } from "effect";

import { Ledger } from "@repo/ledger/model";

// The one place a host is chosen. Each target names the platform the model runs on, so adding cloudflare or rivet is one
// More literal here and one more entry in platforms; the model, the Api and every surface stay as they are.
const AppTarget = Config.Literals(["local"], "APP_TARGET");

type AppTarget = typeof AppTarget extends Config.Config<infer Target> ? Target : never;

const platforms = {
  local: InMemory,
} satisfies Record<AppTarget, Layer.Layer<Platform, unknown, unknown>>;

// The ledger has no policies or projections yet, so the model's Layer needs no handlers.
const hosted = Ledger.layer(Layer.empty);

const host = Layer.unwrap(Effect.map(AppTarget, (target) => Layer.provide(hosted, platforms[target])));

export { AppTarget, host };
