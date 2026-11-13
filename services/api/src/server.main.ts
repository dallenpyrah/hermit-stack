import { layerHttpServices } from "@effect/platform-node/NodeHttpServer";
import { runMain } from "@effect/platform-node/NodeRuntime";
import { NodeHttpServer, serve } from "alchemy/Http";
import { Config, Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";

import { routes } from "#src/handler.layer.js";
import { host } from "#src/host.layer.js";

// The ledger served from this process, on the platform APP_TARGET names.
const handler = HttpRouter.toHttpEffect(Layer.provide(routes, [host, layerHttpServices]));

const hostname = Config.String("HOST").pipe(Config.withDefault("127.0.0.1"));

// Alchemy's server is the one its Docker and process hosts serve a handler with. It creates the Node server itself,
// So this entry imports no Node builtin. It listens on PORT, 3000 by default, and only on this machine unless HOST
// Says otherwise.
const server = Layer.unwrap(Effect.map(hostname, (name) => NodeHttpServer({ hostname: name })));

const serving = Layer.effectDiscard(Effect.flatMap(handler, serve));

runMain(Layer.launch(Layer.provide(serving, server)));
