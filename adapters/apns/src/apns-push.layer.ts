import { Dispatcher, layerUndiciNoDispatcher, makeDispatcherOptions } from "@effect/platform-node/NodeHttpClient";
import { H2CClient } from "@effect/platform-node/Undici";
import { Clock, Config, Duration, Effect, Exit, Layer, Option, String as Str } from "effect";
import { Hex } from "effect/encoding";
import { Headers, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import { DeviceGone, Push } from "@repo/outbound/push";

import { ApnsError } from "#src/apns-api.schema.js";
import { providerToken } from "#src/provider-token.pure.js";

// APNs answers a send within a few seconds; a request still open after this is treated as lost.
const defaultTimeout = Duration.fromInputUnsafe("10 seconds");

const apnsConfig = Config.all({
  baseUrl: Config.String("APNS_BASE_URL").pipe(Config.withDefault("https://api.push.apple.com")),
  keyId: Config.String("APNS_KEY_ID"),
  privateKey: Config.Redacted("APNS_PRIVATE_KEY"),
  teamId: Config.String("APNS_TEAM_ID"),
  timeout: Config.Duration("APNS_TIMEOUT").pipe(Config.withDefault(defaultTimeout)),
  topic: Config.String("APNS_TOPIC"),
});

// Apple wants a provider token refreshed no more than every 20 minutes and no less than every 60.
const tokenLifetime = Duration.fromInputUnsafe("50 minutes");

const uuidGroups = /^(?<time>.{8})(?<mid>.{4})(?<high>.{4})(?<clock>.{4})(?<node>.{12}).*$/u;

// APNs speaks only HTTP/2. Over https, undici offers h2 through ALPN and APNs picks it; over plain http, which only a
// Local stand-in serves, undici's H2CClient speaks HTTP/2 with prior knowledge, so no request goes out as HTTP/1.1.
const http2Dispatcher = Effect.fn("ApnsPush.http2Dispatcher")(function* http2Dispatcher(baseUrl: string) {
  if (new globalThis.URL(baseUrl).protocol === "http:") {
    return yield* Effect.acquireRelease(
      Effect.sync(() => new H2CClient(baseUrl)),
      (client) => Effect.promise(() => client.destroy()),
    );
  }

  return yield* makeDispatcherOptions({ allowH2: true });
});

const configuredDispatcher = Layer.effect(
  Dispatcher,
  Effect.flatMap(apnsConfig, ({ baseUrl }) => http2Dispatcher(baseUrl)),
);

const http2Client = layerUndiciNoDispatcher.pipe(Layer.provide(configuredDispatcher));

const unexpected = Effect.fn("ApnsPush.unexpected")(function* unexpected(
  response: HttpClientResponse.HttpClientResponse,
) {
  const body = yield* Effect.orDie(response.text);

  return yield* Effect.die(new Error(`APNs answered ${response.status}: ${body}`));
});

// 410 is APNs saying the token is no longer active for the topic, Unregistered or ExpiredToken. A 400 BadDeviceToken
// Also follows from a token sent to the wrong environment, a configuration fault, so it is not taken as DeviceGone.
const gone = Effect.fn("ApnsPush.gone")(function* gone(response: HttpClientResponse.HttpClientResponse) {
  const { reason } = yield* Effect.orDie(HttpClientResponse.schemaBodyJson(ApnsError)(response));

  return yield* Effect.fail(DeviceGone.make({ reason }));
});

// The key's SHA-256: its first 16 bytes in the 8-4-4-4-12 layout APNs takes as apns-id, and all 32 as the 64-byte
// Apns-collapse-id, APNs's limit.
const identifiersOf = Effect.fn("ApnsPush.identifiersOf")(function* identifiersOf(idempotencyKey: string) {
  const bytes = new globalThis.TextEncoder().encode(idempotencyKey);
  const digest = yield* Effect.promise(() => globalThis.crypto.subtle.digest("SHA-256", bytes));
  const collapseId = Hex.encode(new Uint8Array(digest));

  return { apnsId: Str.replace(uuidGroups, "$<time>-$<mid>-$<high>-$<clock>-$<node>")(collapseId), collapseId };
});

// The Push port through APNs's POST /3/device/<token> with a token-based connection. APNs keeps no idempotency key,
// So the adapter makes a repeat harmless on the device: every send of one key carries the same apns-collapse-id, so
// The device shows one notification for them, and the same apns-id, which the send answers with. A token APNs no
// Longer knows is DeviceGone; a timeout, a rate limit or a 5xx fails as a defect, so the dispatch runs again later.
const ApnsPush = Push.toLayer(
  Effect.gen(function* apnsPush() {
    const { baseUrl, keyId, privateKey, teamId, timeout, topic } = yield* apnsConfig;
    const http = yield* HttpClient.HttpClient;

    const signToken = Effect.flatMap(Clock.currentTimeMillis, (nowMillis) =>
      providerToken({ keyId, nowMillis, privateKey, teamId }),
    );

    const bearer = yield* Effect.cachedWithTTL(signToken, (exit) =>
      Exit.match(exit, { onFailure: () => Duration.zero, onSuccess: () => tokenLifetime }),
    );

    return {
      send: Effect.fn("ApnsPush.send")(function* send({ body, idempotencyKey, title, token }) {
        const { apnsId, collapseId } = yield* identifiersOf(idempotencyKey);
        const jwt = yield* bearer;

        const request = HttpClientRequest.post(`${baseUrl}/3/device/${token}`).pipe(
          HttpClientRequest.setHeaders({
            "apns-collapse-id": collapseId,
            "apns-id": apnsId,
            "apns-push-type": "alert",
            "apns-topic": topic,
            authorization: `bearer ${jwt}`,
          }),
          HttpClientRequest.bodyJsonUnsafe({ aps: { alert: { body, title } } }),
        );

        const response = yield* http.execute(request).pipe(Effect.timeout(timeout), Effect.orDie);

        return yield* HttpClientResponse.matchStatus(response, {
          200: (accepted) =>
            Effect.succeed({ messageId: Option.getOrElse(Headers.get(accepted.headers, "apns-id"), () => apnsId) }),
          410: gone,
          orElse: unexpected,
        });
      }),
    };
  }),
).pipe(Layer.provide(http2Client));

export { ApnsPush };
