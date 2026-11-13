import { Context } from "effect";
import type { Effect, Stream } from "effect";

import type { OutgoingMessage } from "#src/protocol/message.schema.js";

// The wire between a panel and its host. In a browser it is postMessage to the parent window; in a test it is a fake
// Host, so the panel's protocol runs without a browser. Incoming messages are left undecoded: the host is untrusted,
// And PanelHost decodes each one against the specification.
class HostChannel extends Context.Service<
  HostChannel,
  {
    readonly incoming: Stream.Stream<unknown>;
    readonly send: (message: OutgoingMessage) => Effect.Effect<void>;
  }
>()("@repo/mcp-app/panel/host-channel.service/HostChannel") {}

export { HostChannel };
