import { layer as nodeDns } from "@effect/platform-node/NodeDns";
import { buildConnector } from "@effect/platform-node/Undici";
import { Array as Arr, Effect, Layer } from "effect";
import { Dns, NetAddress } from "effect/net";

import { Network } from "#src/network.service.js";

// The host's real network: the system resolver answers names, and undici's own connector dials the checked address.
const NodeNetwork = Layer.effect(
  Network,
  Effect.gen(function* nodeNetwork() {
    const dns = yield* Dns.Dns;

    return {
      dial: buildConnector({}),
      lookup: (hostname: string): Effect.Effect<readonly string[]> =>
        dns.lookup(hostname).pipe(
          Effect.map(Arr.map(NetAddress.formatIp)),
          Effect.orElseSucceed(() => []),
        ),
    };
  }),
).pipe(Layer.provide(nodeDns));

export { NodeNetwork };
