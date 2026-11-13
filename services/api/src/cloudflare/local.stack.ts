import { localState, Stack } from "alchemy";
import { Effect } from "effect";

import { stackProviders } from "@repo/cloudflare/stack-providers";

import LedgerWorker from "#src/cloudflare/ledger.worker.js";

// `alchemy dev src/cloudflare/local.stack.ts` runs the Worker and its Durable Objects in workerd on this machine, with
// The stack's state and each object's storage under `.alchemy/` in the working directory. Deploying the target, with a
// Shared state store and credentials, is infra's.
const localStack = Stack(
  "hermit-stack-ledger",
  { providers: stackProviders, state: localState() },
  Effect.map(LedgerWorker, (worker) => ({ url: worker.url })),
);

export default localStack;
