#!/usr/bin/env bun
import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer } from "@effect/platform-node/NodeServices";
import { Effect } from "effect";

import { ledger } from "#src/ledger.layer.js";

runMain(Effect.provide(ledger(), layer));
