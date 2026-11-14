import { Layer } from "effect";

import { durableObjects } from "@repo/rivet/durable-objects";
import { localSwarm } from "@repo/rivet/local-swarm";

import { ledger } from "#src/host.layer.js";

const rivetLedger = Layer.provide(
  ledger,
  durableObjects({ handler: "rivetLedger", main: import.meta.url, name: "Ledger", pool: localSwarm }),
);

export { rivetLedger };
