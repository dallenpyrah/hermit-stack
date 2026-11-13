import { Layer } from "effect";

import { durableObjects } from "@repo/rivet/durable-objects";
import { localSwarm } from "@repo/rivet/local-swarm";

import { ledger } from "#src/host.layer.js";

// The Rivet target: one Rivet actor class named `Ledger` hosts the model, and each account is one actor of it, keyed
// `Ledger.AccountAggregate/<account id>`. That class name and those keys are where existing state lives, so renaming
// Either starts the ledger empty on Rivet. The pool's nodes load this export to run the actors; a process that serves
// The routes provides the same Layer and reaches the actors through the engine's gateway. A GCP or AWS pool replaces
// `localSwarm` one for one.
const rivetLedger = Layer.provide(
  ledger,
  durableObjects({ handler: "rivetLedger", main: import.meta.url, name: "Ledger", pool: localSwarm }),
);

export { rivetLedger };
