import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Schema } from "effect";
import type { Vitest } from "@effect/vitest";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { TestClock } from "effect/testing";

import { EndpointId } from "@repo/outbound/endpoint-id";
import { TransportFailed, WebhookTransport } from "@repo/outbound/webhook-transport";
import { webhookTransportContract } from "@repo/outbound/webhook-transport-contract";
import { WebhookReceivers } from "@repo/outbound/webhook-transport-fake";

import { WebhookHttp, WebhookHttpLive } from "#src/webhook-http.layer.js";
import { NetworkFake, ReceiverServer } from "#tests/network.fake";

const throughFakeNetwork = WebhookHttp.pipe(Layer.provideMerge(NetworkFake));

const onRealNetwork = WebhookHttpLive.pipe(Layer.provideMerge(NetworkFake), Layer.provideMerge(FetchHttpClient.layer));

const isTransportFailed = Schema.is(TransportFailed);

const event = {
  audience: [],
  id: "event-1",
  occurredAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
  payload: {},
  type: "invoice.paid",
};

const position = 1;

const oneRequest = 1;

const endpointId = EndpointId.make("endpoint-1");

const refusesUrl = Effect.fn("refusesUrl")(function* refusesUrlAt(url: string) {
  const transport = yield* WebhookTransport;
  const failure = yield* Effect.flip(transport.post({ endpointId, event, position, url }));

  return isTransportFailed(failure);
});

const postDirectly = Effect.fn("postDirectly")(function* postDirectlyTo(url: string) {
  const client = yield* HttpClient.HttpClient;

  return yield* client.execute(HttpClientRequest.post(url));
});

const refusesLoopbackReceiver = Effect.gen(function* refusesLoopbackReceiverCase() {
  const receivers = yield* WebhookReceivers;
  const { address } = yield* ReceiverServer;
  const receiver = yield* receivers.open;
  const { port } = new globalThis.URL(`http://${address}`);

  const refused = yield* Effect.forEach([address, `localhost:${port}`, `[::ffff:127.0.0.1]:${port}`], (host) =>
    refusesUrl(receiver.urlAt(host)),
  );

  const reachedByTransport = yield* receiver.received;
  const reachedDirectly = yield* postDirectly(receiver.urlAt(address)).pipe(Effect.andThen(receiver.received));

  expect(refused).toStrictEqual([true, true, true]);
  expect(reachedByTransport).toStrictEqual([]);
  expect(reachedDirectly).toHaveLength(oneRequest);
});

it.layer(throughFakeNetwork)(
  "the HTTP webhook transport, on a network where every address leads to a local receiver",
  webhookTransportContract,
);

it.layer(onRealNetwork)(
  "the HTTP webhook transport as the host runs it, on the real network",
  (onLive: Vitest.MethodsNonLive<Layer.Success<typeof onRealNetwork>>) => {
    onLive.effect("refuses the local receiver at its loopback address, by number and by name", () =>
      TestClock.withLive(refusesLoopbackReceiver),
    );
  },
);
