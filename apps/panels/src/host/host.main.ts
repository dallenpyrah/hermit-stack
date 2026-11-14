#!/usr/bin/env bun
import { InMemory } from "@alchemy.run/domain";
import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { runMain } from "@effect/platform-node/NodeRuntime";
import { Layer } from "effect";
import { HttpRouter } from "effect/http";

import { Ledger } from "@repo/ledger/model";

import { host } from "#src/host/host-routes.layer.js";

// A page that plays an MCP Apps host for the account panel, so the panel opens in a browser without an agent host. It
// Serves the ledger's MCP server on an in-memory ledger, with the host page beside it, and logs the address it listens
// On. NodeHttpServer's layerTest is a real server on a free port with an HTTP client aimed at it, which is what the
// Host's own MCP client needs.
const ledger = Ledger.layer(Layer.empty).pipe(Layer.provide(InMemory));

const served = HttpRouter.serve(host, { disableLogger: true }).pipe(Layer.provide(ledger), Layer.provide(layerTest));

runMain(Layer.launch(served));
