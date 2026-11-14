import { Context } from "effect";
import type { Effect } from "effect";

import type { buildConnector } from "@effect/platform-node/Undici";

class Network extends Context.Service<
  Network,
  {
    readonly dial: buildConnector.connector;
    readonly lookup: (hostname: string) => Effect.Effect<readonly string[]>;
  }
>()("@repo/webhook-http/network.service/Network") {}

export { Network };
