import { Array as Arr, Clock, Config, Duration, Effect, Exit, Layer } from "effect";
import { Hex } from "effect/encoding";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import { DeviceGone, Push } from "@repo/outbound/push";

import { AccessToken, FcmError, SentMessage } from "#src/fcm-api.schema.js";
import { signedAssertion } from "#src/service-account.pure.js";

const defaultTimeout = Duration.fromInputUnsafe("10 seconds");

const fcmConfig = Config.all({
  baseUrl: Config.String("FCM_BASE_URL").pipe(Config.withDefault("https://fcm.googleapis.com")),
  clientEmail: Config.String("FCM_CLIENT_EMAIL"),
  privateKey: Config.Redacted("FCM_PRIVATE_KEY"),
  projectId: Config.String("FCM_PROJECT_ID"),
  timeout: Config.Duration("FCM_TIMEOUT").pipe(Config.withDefault(defaultTimeout)),
  tokenUrl: Config.String("FCM_TOKEN_URL").pipe(Config.withDefault("https://oauth2.googleapis.com/token")),
});

type FcmConfig = typeof fcmConfig extends Config.Config<infer Values> ? Values : never;

const expiryMarginSeconds = 60;

const unregistered = "UNREGISTERED";

const unexpected = Effect.fn("FcmPush.unexpected")(function* unexpected(
  response: HttpClientResponse.HttpClientResponse,
) {
  const body = yield* Effect.orDie(response.text);

  return yield* Effect.die(new Error(`FCM answered ${response.status}: ${body}`));
});

const gone = Effect.fn("FcmPush.gone")(function* gone(response: HttpClientResponse.HttpClientResponse) {
  const { error }: FcmError = yield* Effect.orDie(HttpClientResponse.schemaBodyJson(FcmError)(response));

  if (Arr.some(error.details ?? [], (detail) => detail.errorCode === unregistered)) {
    return yield* Effect.fail(DeviceGone.make({ reason: error.message }));
  }

  return yield* Effect.die(new Error(`FCM answered ${error.status}: ${error.message}`));
});

const exchange = Effect.fn("FcmPush.exchange")(function* exchange(
  http: HttpClient.HttpClient,
  { clientEmail, privateKey, timeout, tokenUrl }: FcmConfig,
) {
  const nowMillis = yield* Clock.currentTimeMillis;
  const assertion = yield* signedAssertion({ clientEmail, nowMillis, privateKey, tokenUrl });

  const request = HttpClientRequest.post(tokenUrl).pipe(
    HttpClientRequest.bodyUrlParams({ assertion, grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer" }),
  );

  const response = yield* http
    .execute(request)
    .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk), Effect.timeout(timeout), Effect.orDie);

  return yield* Effect.orDie(HttpClientResponse.schemaBodyJson(AccessToken)(response));
});

const FcmPush = Push.toLayer(
  Effect.gen(function* fcmPush() {
    const config = yield* fcmConfig;
    const http = yield* HttpClient.HttpClient;

    const accessToken = yield* Effect.cachedWithTTL(exchange(http, config), (exit) =>
      Exit.match(exit, {
        onFailure: () => Duration.zero,
        onSuccess: (token) => Duration.seconds(token.expires_in - expiryMarginSeconds),
      }),
    );

    const sendUrl = `${config.baseUrl}/v1/projects/${config.projectId}/messages:send`;

    return {
      send: Effect.fn("FcmPush.send")(function* send({ body, idempotencyKey, title, token }) {
        const keyBytes = new globalThis.TextEncoder().encode(idempotencyKey);
        const digest = yield* Effect.promise(() => globalThis.crypto.subtle.digest("SHA-256", keyBytes));
        const tag = Hex.encode(new Uint8Array(digest));
        const { access_token: bearer } = yield* accessToken;

        const message = {
          android: { notification: { tag } },
          apns: { headers: { "apns-collapse-id": tag } },
          notification: { body, title },
          token,
        };

        const request = HttpClientRequest.post(sendUrl).pipe(
          HttpClientRequest.bearerToken(bearer),
          HttpClientRequest.bodyJsonUnsafe({ message }),
        );

        const response = yield* http.execute(request).pipe(Effect.timeout(config.timeout), Effect.orDie);

        return yield* HttpClientResponse.matchStatus(response, {
          200: (accepted) =>
            Effect.as(Effect.orDie(HttpClientResponse.schemaBodyJson(SentMessage)(accepted)), { messageId: tag }),
          404: gone,
          orElse: unexpected,
        });
      }),
    };
  }),
).pipe(Layer.provide(FetchHttpClient.layer));

export { FcmPush };
