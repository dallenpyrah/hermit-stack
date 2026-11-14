import { Context } from "effect";
import type { Effect } from "effect";

import type { buildConnector } from "@effect/platform-node/Undici";

// The network the transport reaches receivers through: the addresses a name resolves to, and the connection for one
// Request once its address has been checked, as undici's connector opens it. The host's network is the real one; a
// Test replaces it with one where every address leads to a local receiver, so the address check between the two runs
// Unchanged.
class Network extends Context.Service<
  Network,
  {
    readonly dial: buildConnector.connector;
    // The IP addresses the name resolves to, empty when it resolves to none.
    readonly lookup: (hostname: string) => Effect.Effect<readonly string[]>;
  }
>()("@repo/webhook-http/network.service/Network") {}

export { Network };
