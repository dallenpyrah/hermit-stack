import { Platform } from "alchemy/Http";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";

import { durableObjects } from "@repo/cloudflare/durable-objects";
import { compatibility, Worker } from "@repo/cloudflare/worker";

import { routes } from "#src/handler.layer.js";
import { ledger } from "#src/host.layer.js";

// The Cloudflare target: each account is one Durable Object of this Worker, named `Ledger.AccountAggregate` with the
// Account id as its instance name. Those names are where existing data lives, so renaming the model or the aggregate
// Starts the ledger empty on Cloudflare.
const hosted = Layer.provide(ledger, durableObjects);

const handler = HttpRouter.toHttpEffect(Layer.orDie(Layer.provide(routes, [hosted, Platform])));

// Alchemy bundles this module for workerd and finds the Worker as its default export. The id names the script.
class LedgerWorker extends Worker<LedgerWorker>()(
  "LedgerApi",
  { compatibility, main: import.meta.url },
  Effect.map(handler, (fetch) => ({ fetch })),
) {}

export default LedgerWorker;
