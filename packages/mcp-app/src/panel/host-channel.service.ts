import { Context } from "effect";
import type { Effect, Stream } from "effect";

import type { OutgoingMessage } from "#src/protocol/message.schema.js";

class HostChannel extends Context.Service<
  HostChannel,
  {
    readonly incoming: Stream.Stream<unknown>;
    readonly send: (message: OutgoingMessage) => Effect.Effect<void>;
  }
>()("@repo/mcp-app/panel/host-channel.service/HostChannel") {}

export { HostChannel };
