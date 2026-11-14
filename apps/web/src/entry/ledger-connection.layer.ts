import { protocolWebSocket } from "@alchemy.run/domain";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { Socket } from "effect/socket";

import { LedgerApi } from "@repo/ledger/api";

const ledgerConnection = (origin: string): Layer.Layer<typeof LedgerApi.Client.Identifier> =>
  LedgerApi.layerClient.pipe(
    Layer.provide(protocolWebSocket(`${origin}/rpc`)),
    Layer.provide(Layer.merge(FetchHttpClient.layer, Socket.layerWebSocketConstructorGlobal)),
  );

export { ledgerConnection };
