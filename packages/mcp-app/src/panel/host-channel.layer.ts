import { Effect, Layer, Queue, Stream } from "effect";

import { HostChannel } from "#src/panel/host-channel.service.js";
import { panelHost } from "#src/panel/panel-host.layer.js";
import { PanelHost } from "#src/panel/panel-host.service.js";
import type { Size } from "#src/panel/panel-host.service.js";
import type { HostHandshakeError } from "#src/panel/host-handshake.errors.js";
import type { Implementation } from "#src/protocol/message.schema.js";

// The host is the window that framed the panel. A message from anywhere else, such as a frame the panel opened, is not
// The host's and is dropped. The panel cannot know the host's origin in advance, so it posts to any.
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

// The body's height, with the window's width: measuring the width of content that takes its width from the frame
// Would only report the frame back.
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

// Reports each change in the panel's size, so a host with a flexible container fits the panel to its content.
const followSize = Layer.effectDiscard(
  Effect.flatMap(PanelHost, (host) =>
    Effect.forkScoped(Stream.runForEach(Stream.changesWith(resizes, sameSize), host.reportSize)),
  ),
);

// The PanelHost a panel uses in the browser: the protocol over postMessage to the framing window, with its size
// Reported as it changes.
const browserPanelHost = (appInfo: Implementation): Layer.Layer<PanelHost, HostHandshakeError> =>
  Layer.provideMerge(followSize, panelHost(appInfo)).pipe(Layer.provide(windowChannel));

export { browserPanelHost, windowChannel };
