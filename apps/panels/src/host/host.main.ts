#!/usr/bin/env bun
import { InMemory } from "@alchemy.run/domain";
import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { runMain } from "@effect/platform-node/NodeRuntime";
import { Layer } from "effect";
import { HttpRouter } from "effect/http";

import { Ledger } from "@repo/ledger/model";

import { host } from "#src/host/host-routes.layer.js";

const ledger = Ledger.layer(Layer.empty).pipe(Layer.provide(InMemory));

const served = HttpRouter.serve(host, { disableLogger: true }).pipe(Layer.provide(ledger), Layer.provide(layerTest));

runMain(Layer.launch(served));
