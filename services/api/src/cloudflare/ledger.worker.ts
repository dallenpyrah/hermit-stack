import { Platform } from "alchemy/Http";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";

import { durableObjects } from "@repo/cloudflare/durable-objects";
import { compatibility, Worker } from "@repo/cloudflare/worker";

import { routes } from "#src/handler.layer.js";
import { ledger } from "#src/host.layer.js";

const hosted = Layer.provide(ledger, durableObjects);

const handler = HttpRouter.toHttpEffect(Layer.orDie(Layer.provide(routes, [hosted, Platform])));

class LedgerWorker extends Worker<LedgerWorker>()(
  "LedgerApi",
  { compatibility, main: import.meta.url },
  Effect.map(handler, (fetch) => ({ fetch })),
) {}

export default LedgerWorker;
