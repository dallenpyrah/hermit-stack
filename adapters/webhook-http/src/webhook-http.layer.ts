import { Dispatcher, layerUndiciNoDispatcher, makeDispatcherOptions } from "@effect/platform-node/NodeHttpClient";
import { Config, DateTime, Duration, Effect, Layer } from "effect";
import { Headers, HttpClient, HttpClientRequest } from "effect/http";

import { TransportFailed, WebhookTransport } from "@repo/outbound/webhook-transport";

import { guardedConnector } from "#src/address-guard.pure.js";
import { Network } from "#src/network.service.js";
import { NodeNetwork } from "#src/node-network.layer.js";
import { SigningSecrets } from "#src/signing-secrets.service.js";
import { retryAfterSeconds, signedMessage } from "#src/standard-webhooks.pure.js";

const defaultTimeout = Duration.fromInputUnsafe("15 seconds");

const webhookTimeout = Config.Duration("WEBHOOK_HTTP_TIMEOUT").pipe(Config.withDefault(defaultTimeout));

const guardedDispatcher = Layer.effect(
  Dispatcher,
  Effect.gen(function* guardedDispatcherOptions() {
    const network = yield* Network;

    return yield* makeDispatcherOptions({ connect: guardedConnector(network) });
  }),
);

const guardedClient = layerUndiciNoDispatcher.pipe(Layer.provide(guardedDispatcher));

const WebhookHttp = WebhookTransport.toLayer(
  Effect.gen(function* webhookHttp() {
    const timeout = yield* webhookTimeout;
    const secrets = yield* SigningSecrets;
    const http = yield* HttpClient.HttpClient;
    const client = HttpClient.withScope(http);

    return {
      post: Effect.fn("WebhookHttp.post")(function* post({ endpointId, event, position, url }) {
        const secret = yield* secrets.secretOf(endpointId);
        const sentAt = yield* DateTime.now;
        const message = yield* signedMessage({ event, now: sentAt, position, secret });

        const request = HttpClientRequest.post(url).pipe(
          HttpClientRequest.setHeaders(message.headers),
          HttpClientRequest.bodyText(message.body, "application/json"),
        );

        const response = yield* Effect.scoped(client.execute(request)).pipe(
          Effect.timeout(timeout),
          Effect.mapError((failed) => TransportFailed.make({ reason: failed.message })),
        );

        const answeredAt = yield* DateTime.now;
        const retryAfter = Headers.get(response.headers, "retry-after");

        return {
          retryAfterSeconds: retryAfterSeconds({ now: answeredAt, value: retryAfter }),
          status: response.status,
        };
      }),
    };
  }),
).pipe(Layer.provide(guardedClient));

const WebhookHttpLive = WebhookHttp.pipe(Layer.provide(NodeNetwork));

export { WebhookHttp, WebhookHttpLive };
