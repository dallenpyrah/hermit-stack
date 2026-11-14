import { InMemory } from "@alchemy.run/domain";
import type { Platform } from "@alchemy.run/domain";
import { Config, Effect, Layer } from "effect";

import { Ledger } from "@repo/ledger/model";

const ledger = Ledger.layer(Layer.empty);

const AppTarget = Config.Literals(["local"], "APP_TARGET");

type AppTarget = typeof AppTarget extends Config.Config<infer Target> ? Target : never;

const platforms = {
  local: InMemory,
} satisfies Record<AppTarget, Layer.Layer<Platform, unknown, unknown>>;

const host = Layer.unwrap(Effect.map(AppTarget, (target) => Layer.provide(ledger, platforms[target])));

export { AppTarget, host, ledger };
