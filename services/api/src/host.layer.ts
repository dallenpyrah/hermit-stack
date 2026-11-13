import { InMemory } from "@alchemy.run/domain";
import { Config, Effect, Layer } from "effect";

import { Ledger } from "@repo/ledger/model";

// The ledger before a platform runs its actors. Each target provides one platform to it; the model, the Api and every
// Surface stay the same. The ledger has no policies or projections yet, so the model's Layer needs no handlers.
const ledger = Ledger.layer(Layer.empty);

// The targets a plain server process can host: the ones whose platform runs inside that process. The Cloudflare
// Target is a Worker and the Rivet target is a pool of nodes, so each has its own entry module under src/ that imports
// Only its own adapter; one table here would pull every vendor's runtime into every bundle.
const AppTarget = Config.Literals(["local"], "APP_TARGET");

type AppTarget = typeof AppTarget extends Config.Config<infer Target> ? Target : never;

const platforms = {
  local: InMemory,
} satisfies Record<AppTarget, typeof InMemory>;

const host = Layer.unwrap(Effect.map(AppTarget, (target) => Layer.provide(ledger, platforms[target])));

export { AppTarget, host, ledger };
