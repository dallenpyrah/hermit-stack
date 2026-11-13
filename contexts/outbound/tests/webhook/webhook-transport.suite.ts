import type { Identifier } from "@alchemy.run/domain/ExternalSystem";
import { expect } from "@effect/vitest";
import type { Vitest } from "@effect/vitest";
import { Array as Arr, DateTime, Effect, Option, Record as Rec, Schema, String as Str } from "effect";
import { Base64 } from "effect/encoding";
import { TestClock } from "effect/testing";

import { EndpointId } from "#src/webhook/endpoint.id.js";
import { TransportFailed, WebhookTransport } from "#src/webhook/webhook-transport.external.js";
import { WebhookReceivers } from "#tests/webhook/webhook-transport.fake";

type WebhookServices = WebhookReceivers | Identifier<typeof WebhookTransport>;

// A case fails with what the port can fail with, or with the answer to a post that should have been refused.
type Promise = Effect.Effect<void, object, WebhookServices>;

interface ReceivedRequest {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
}

interface ReceiverAnswer {
  readonly headers: Readonly<Record<string, string>>;
  readonly status: number;
}

interface Posted {
  readonly answer: { readonly retryAfterSeconds: Option.Option<number>; readonly status: number };
  readonly received: readonly ReceivedRequest[];
}

const endpointId = EndpointId.make("endpoint-1");

const otherEndpointId = EndpointId.make("endpoint-2");

const event = {
  audience: ["user-1"],
  id: "event-1",
  occurredAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
  payload: { amount: 4200, invoiceId: "invoice-7" },
  type: "invoice.paid",
};

const position = 3;

const once = 1;

const noContent = 204;

const temporaryRedirect = 307;

const tooManyRequests = 429;

const serverError = 500;

const unavailable = 503;

const secretPrefix = "whsec_";

const signaturePrefix = "v1,";

const millisPerSecond = 1000;

// Standard Webhooks' reference verifier accepts a timestamp up to five minutes away from its own clock.
const toleranceMillis = 300_000;

const retryAfter = 120;

// An HTTP-date carries whole seconds and the post takes a moment, so a date two minutes ahead reads back a little
// Under 120 seconds.
const retryAfterSlack = 5;

// The addresses a webhook must never reach: loopback, unspecified, private, link-local and unique local, and an IPv4
// Loopback written as IPv6.
const privateHosts = [
  "127.0.0.1",
  "localhost",
  "[::1]",
  "[::ffff:127.0.0.1]",
  "0.0.0.0",
  "10.0.0.7",
  "172.16.0.7",
  "192.168.0.7",
  "169.254.169.254",
  "[fd00::7]",
  "[fe80::7]",
] as const;

const hmac = { hash: "SHA-256", name: "HMAC" } as const;

const isTransportFailed = Schema.is(TransportFailed);

const header = (request: ReceivedRequest, name: string): string =>
  Option.getOrElse(Rec.get(request.headers, name), () => "");

const withoutPrefix = (prefix: string, text: string): string => Str.slice(prefix.length)(text);

const firstRequest = (posted: Posted): ReceivedRequest =>
  Option.getOrElse(Arr.head(posted.received), () => ({ body: "", headers: {}, method: "" }));

// Opens a receiver that answers as given, posts the event to it for the endpoint, and returns the transport's answer
// With every request the receiver got.
const postAnswered = Effect.fn("postAnswered")(function* postAnswered(answer: ReceiverAnswer) {
  const transport = yield* WebhookTransport;
  const receivers = yield* WebhookReceivers;
  const receiver = yield* receivers.open;

  yield* receiver.answerWith(answer);

  const reply = yield* transport.post({ endpointId, event, position, url: receiver.url });
  const received = yield* receiver.received;

  return { answer: reply, received } satisfies Posted;
});

// Verifies a request as a receiver following Standard Webhooks would: HMAC-SHA256 of id.timestamp.body under the
// Base64 key after whsec_, checked through WebCrypto against each space-separated v1 signature.
const verifies = Effect.fn("verifies")(function* verifies(secret: string, request: ReceivedRequest) {
  const signed = `${header(request, "webhook-id")}.${header(request, "webhook-timestamp")}.${request.body}`;
  const content = new globalThis.TextEncoder().encode(signed);
  const candidates = Str.split(header(request, "webhook-signature"), " ");

  const tags = Arr.getSuccesses(
    Arr.map(candidates, (candidate) => Base64.decode(withoutPrefix(signaturePrefix, candidate))),
  );

  const decodedSecret = Base64.decode(withoutPrefix(secretPrefix, secret));
  const bytes = yield* Effect.orDie(Effect.fromResult(decodedSecret));

  const key = yield* Effect.promise(() => globalThis.crypto.subtle.importKey("raw", bytes, hmac, false, ["verify"]));

  const results = yield* Effect.forEach(tags, (tag) =>
    Effect.promise(() => globalThis.crypto.subtle.verify(hmac, key, tag, content)),
  );

  return Arr.some(results, (valid) => valid);
});

const postsTheEvent = Effect.gen(function* postsTheEventCase() {
  const posted = yield* postAnswered({ headers: {}, status: noContent });
  const request = firstRequest(posted);
  const body = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(request.body);

  expect(posted.answer).toStrictEqual({ retryAfterSeconds: Option.none(), status: noContent });
  expect(posted.received).toHaveLength(once);
  expect(request).toMatchObject({
    headers: { "content-type": "application/json", "webhook-id": event.id },
    method: "POST",
  });
  expect(body).toStrictEqual({
    data: event.payload,
    position,
    timestamp: "2026-01-01T00:00:00.000Z",
    type: event.type,
  });
});

const signsForTheEndpoint = Effect.gen(function* signsForTheEndpointCase() {
  const receivers = yield* WebhookReceivers;
  const request = yield* Effect.map(postAnswered({ headers: {}, status: noContent }), firstRequest);
  const secrets = yield* Effect.all([receivers.secretOf(endpointId), receivers.secretOf(otherEndpointId)]);
  const [signedWithSecret, signedWithOther] = yield* Effect.forEach(secrets, (secret) => verifies(secret, request));
  const now = yield* DateTime.now;
  const sentAt = Number(header(request, "webhook-timestamp")) * millisPerSecond;

  expect(signedWithSecret).toBe(true);
  expect(signedWithOther).toBe(false);
  expect(Math.abs(DateTime.toEpochMillis(now) - sentAt)).toBeLessThan(toleranceMillis);
});

const reportsRetryAfterSeconds = Effect.gen(function* reportsRetryAfterSecondsCase() {
  const posted = yield* postAnswered({ headers: { "retry-after": String(retryAfter) }, status: tooManyRequests });

  expect(posted.answer).toStrictEqual({ retryAfterSeconds: Option.some(retryAfter), status: tooManyRequests });
});

const reportsRetryAfterDate = Effect.gen(function* reportsRetryAfterDateCase() {
  const now = yield* DateTime.now;
  const at = DateTime.toDateUtc(DateTime.add(now, { seconds: retryAfter })).toUTCString();
  const posted = yield* postAnswered({ headers: { "retry-after": at }, status: unavailable });
  const seconds = Option.getOrElse(posted.answer.retryAfterSeconds, () => Number.NaN);

  expect(posted.answer.status).toBe(unavailable);
  expect(seconds).toBeGreaterThanOrEqual(retryAfter - retryAfterSlack);
  expect(seconds).toBeLessThanOrEqual(retryAfter);
});

const reportsFailureWithoutRetryAfter = Effect.gen(function* reportsFailureWithoutRetryAfterCase() {
  const posted = yield* postAnswered({ headers: {}, status: serverError });

  expect(posted.answer).toStrictEqual({ retryAfterSeconds: Option.none(), status: serverError });
});

const followsNoRedirect = Effect.gen(function* followsNoRedirectCase() {
  const transport = yield* WebhookTransport;
  const receivers = yield* WebhookReceivers;
  const receiver = yield* receivers.open;

  // The receiver sends the transport back to itself, so a transport that followed it would post a second time.
  yield* receiver.answerWith({ headers: { location: receiver.url }, status: temporaryRedirect });

  const answer = yield* transport.post({ endpointId, event, position, url: receiver.url });
  const received = yield* receiver.received;

  expect(answer).toStrictEqual({ retryAfterSeconds: Option.none(), status: temporaryRedirect });
  expect(received).toHaveLength(once);
});

const silentReceiverFails = Effect.gen(function* silentReceiverFailsCase() {
  const transport = yield* WebhookTransport;
  const receivers = yield* WebhookReceivers;
  const receiver = yield* receivers.open;

  yield* receiver.stopAnswering;

  const failed = yield* Effect.flip(transport.post({ endpointId, event, position, url: receiver.url }));

  expect(isTransportFailed(failed)).toBe(true);
});

const refusesPrivateHosts = Effect.gen(function* refusesPrivateHostsCase() {
  const transport = yield* WebhookTransport;
  const receivers = yield* WebhookReceivers;
  const receiver = yield* receivers.open;

  const refused = yield* Effect.filter(privateHosts, (host) => {
    const posted = transport.post({ endpointId, event, position, url: receiver.urlAt(host) });

    return Effect.map(Effect.flip(posted), isTransportFailed);
  });

  const received = yield* receiver.received;

  expect(refused).toStrictEqual(privateHosts);
  expect(received).toStrictEqual([]);
});

const promises = {
  "a post no answer comes back for fails with TransportFailed": silentReceiverFails,
  "a post to a private or loopback address fails with TransportFailed and reaches nothing": refusesPrivateHosts,
  "a redirect is reported as the answer and never followed": followsNoRedirect,
  "a refusal without Retry-After reports its status and no retry time": reportsFailureWithoutRetryAfter,
  "a refusal's Retry-After as an HTTP date is reported as the seconds until then": reportsRetryAfterDate,
  "a refusal's Retry-After in seconds is reported with its status": reportsRetryAfterSeconds,
  "the event is posted once as JSON, with its id as webhook-id, and the status is reported": postsTheEvent,
  "the post is signed with its endpoint's secret as Standard Webhooks specifies": signsForTheEndpoint,
} satisfies Readonly<Record<string, Promise>>;

const onLiveClock = (promise: Promise): Promise => TestClock.withLive(promise);

// One test per promise of the WebhookTransport port, against whatever provides the port together with the receivers
// It posts to: the in-memory fake, or the HTTP adapter wired to a local receiver. Run it with
// It.layer(implementation)(title, webhookTransportContract), so every case shares one build. The cases run on the live
// Clock because signatures carry the real time and an adapter's timeout is real time.
const webhookTransportContract = (onImplementation: Vitest.MethodsNonLive<WebhookServices>): void => {
  for (const [title, promise] of Rec.toEntries(promises)) {
    onImplementation.effect(title, () => onLiveClock(promise));
  }
};

export { webhookTransportContract };
