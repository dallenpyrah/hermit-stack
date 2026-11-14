import { Config, Duration, Effect, Function as Fn, Layer } from "effect";
import { Hex } from "effect/encoding";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import { Email, Undeliverable } from "@repo/outbound/email";

import { ResendError, SentEmail } from "#src/resend-api.schema.js";

const defaultTimeout = Duration.fromInputUnsafe("10 seconds");

const resendConfig = Config.all({
  apiKey: Config.Redacted("RESEND_API_KEY"),
  baseUrl: Config.String("RESEND_BASE_URL").pipe(Config.withDefault("https://api.resend.com")),
  from: Config.String("RESEND_FROM"),
  timeout: Config.Duration("RESEND_TIMEOUT").pipe(Config.withDefault(defaultTimeout)),
});

const longestKey = 256;

const refusesRecipient = /`to`/u;

const idempotencyKeyOf = (key: string): Effect.Effect<string> => {
  if (key.length <= longestKey) {
    return Effect.succeed(key);
  }

  const bytes = new globalThis.TextEncoder().encode(key);

  return Effect.map(
    Effect.promise(() => globalThis.crypto.subtle.digest("SHA-256", bytes)),
    (digest) => Hex.encode(new Uint8Array(digest)),
  );
};

const unexpected = Effect.fn("ResendEmail.unexpected")(function* unexpected(
  response: HttpClientResponse.HttpClientResponse,
) {
  const body = yield* Effect.orDie(response.text);

  return yield* Effect.die(new Error(`Resend answered ${response.status}: ${body}`));
});

const refusal = Effect.fn("ResendEmail.refusal")(function* refusal(response: HttpClientResponse.HttpClientResponse) {
  const error: ResendError = yield* Effect.orDie(HttpClientResponse.schemaBodyJson(ResendError)(response));

  if (refusesRecipient.test(error.message)) {
    return yield* Effect.fail(Undeliverable.make({ reason: error.message }));
  }

  return yield* Effect.die(new Error(`Resend refused the request with ${error.name}: ${error.message}`));
});

const answer = (
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<{ readonly messageId: string }, typeof Undeliverable.Type> =>
  HttpClientResponse.matchStatus(response, {
    200: (accepted) =>
      Effect.map(Effect.orDie(HttpClientResponse.schemaBodyJson(SentEmail)(accepted)), ({ id }) => ({
        messageId: id,
      })),
    422: refusal,
    orElse: unexpected,
  });

const ResendEmail = Email.toLayer(
  Effect.gen(function* resendEmail() {
    const { apiKey, baseUrl, from, timeout } = yield* resendConfig;
    const http = yield* HttpClient.HttpClient;

    const client = HttpClient.mapRequest(
      http,
      Fn.flow(
        HttpClientRequest.prependUrl(baseUrl),
        HttpClientRequest.bearerToken(apiKey),
        HttpClientRequest.setHeader("user-agent", "hermit-stack"),
      ),
    );

    return {
      send: Effect.fn("ResendEmail.send")(function* send({ idempotencyKey, subject, text, to }) {
        const key = yield* idempotencyKeyOf(idempotencyKey);

        const request = HttpClientRequest.post("/emails").pipe(
          HttpClientRequest.setHeader("idempotency-key", key),
          HttpClientRequest.bodyJsonUnsafe({ from, subject, text, to: [to] }),
        );

        const response = yield* client.execute(request).pipe(Effect.timeout(timeout), Effect.orDie);

        return yield* answer(response);
      }),
    };
  }),
).pipe(Layer.provide(FetchHttpClient.layer));

export { ResendEmail };
