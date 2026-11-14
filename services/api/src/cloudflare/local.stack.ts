import { localState, Stack } from "alchemy";
import { Effect } from "effect";

import { stackProviders } from "@repo/cloudflare/stack-providers";

import LedgerWorker from "#src/cloudflare/ledger.worker.js";

const localStack = Stack(
  "hermit-stack-ledger",
  { providers: stackProviders, state: localState() },
  Effect.map(LedgerWorker, (worker) => ({ url: worker.url })),
);

export default localStack;
