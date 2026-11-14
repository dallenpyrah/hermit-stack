import { Effect, Layer, Queue, Stream } from "effect";

import { HostChannel } from "#src/panel/host-channel.service.js";
import { panelHost } from "#src/panel/panel-host.layer.js";
import { PanelHost } from "#src/panel/panel-host.service.js";
import type { Size } from "#src/panel/panel-host.service.js";
import type { HostHandshakeError } from "#src/panel/host-handshake.errors.js";
import type { Implementation } from "#src/protocol/message.schema.js";

const windowChannel = Layer.sync(HostChannel, () =>
  HostChannel.of({
    incoming: Stream.fromEventListener<MessageEvent<unknown>>(globalThis, "message").pipe(
      Stream.filter((event) => event.source === globalThis.parent),
      Stream.map((event) => event.data),
    ),
    send: (message) =>
      Effect.sync(() => {
        globalThis.parent.postMessage(message, "*");
      }),
  }),
);

const measure = (): Size => ({
  height: Math.ceil(globalThis.document.body.getBoundingClientRect().height),
  width: Math.ceil(globalThis.innerWidth),
});

const resizes: Stream.Stream<Size> = Stream.callback<Size>((queue) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const observer = new globalThis.ResizeObserver(() => {
        Queue.offerUnsafe(queue, measure());
      });

      observer.observe(globalThis.document.documentElement);
      observer.observe(globalThis.document.body);

      return observer;
    }),
    (observer) =>
      Effect.sync(() => {
        observer.disconnect();
      }),
  ),
);

const sameSize = (before: Size, after: Size): boolean => before.height === after.height && before.width === after.width;

const followSize = Layer.effectDiscard(
  Effect.flatMap(PanelHost, (host) =>
    Effect.forkScoped(Stream.runForEach(Stream.changesWith(resizes, sameSize), host.reportSize)),
  ),
);

const browserPanelHost = (appInfo: Implementation): Layer.Layer<PanelHost, HostHandshakeError> =>
  Layer.provideMerge(followSize, panelHost(appInfo)).pipe(Layer.provide(windowChannel));

export { browserPanelHost, windowChannel };
