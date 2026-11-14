import { DateTime, Effect, Option, Redacted, Schema, String as Str } from "effect";
import { Base64 } from "effect/encoding";

import type { PublicEvent } from "@repo/outbound/public-event";

const secretPrefix = "whsec_";

const millisPerSecond = 1000;

const noWait = 0;

const hmac = { hash: "SHA-256", name: "HMAC" } as const;

// The body Standard Webhooks suggests, type, timestamp and data, with the event's feed position so a receiver can read
// On from the feed. The audience stays inside: it names the users to notify, not something a receiver should see.
const WebhookBody = Schema.fromJsonString(
  Schema.Struct({
    data: Schema.Json,
    position: Schema.Int,
    timestamp: Schema.DateTimeUtcFromString,
    type: Schema.String,
  }),
);

// HMAC-SHA256 through the runtime's WebCrypto, under the key whose base64 follows whsec_ in the secret.
const sign = Effect.fn("StandardWebhooks.sign")(function* sign(secret: Redacted.Redacted, content: string) {
  const encoded = Str.slice(secretPrefix.length)(Redacted.value(secret));
  const bytes = yield* Effect.orDie(Effect.fromResult(Base64.decode(encoded)));
  const key = yield* Effect.promise(() => globalThis.crypto.subtle.importKey("raw", bytes, hmac, false, ["sign"]));
  const signed = new globalThis.TextEncoder().encode(content);
  const tag = yield* Effect.promise(() => globalThis.crypto.subtle.sign(hmac, key, signed));

  return `v1,${Base64.encode(new Uint8Array(tag))}`;
});

interface Delivery {
  readonly event: PublicEvent;
  readonly now: DateTime.Utc;
  readonly position: number;
  readonly secret: Redacted.Redacted;
}

interface SignedMessage {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
}

// The message Standard Webhooks specifies (https://www.standardwebhooks.com): webhook-id is the event id, so a
// Receiver drops repeats, and the v1 signature covers the id, the time in seconds and the exact body sent.
const signedMessage = Effect.fn("StandardWebhooks.signedMessage")(function* signedMessage({
  event,
  now,
  position,
  secret,
}: Delivery): Effect.fn.Return<SignedMessage> {
  const timestamp = String(Math.floor(DateTime.toEpochMillis(now) / millisPerSecond));

  const body = yield* Effect.orDie(
    Schema.encodeEffect(WebhookBody)({ data: event.payload, position, timestamp: event.occurredAt, type: event.type }),
  );

  const signature = yield* sign(secret, `${event.id}.${timestamp}.${body}`);

  return {
    body,
    headers: { "webhook-id": event.id, "webhook-signature": signature, "webhook-timestamp": timestamp },
  };
});

interface RetryAfter {
  readonly now: DateTime.Utc;
  readonly value: Option.Option<string>;
}

// Retry-After is either a number of seconds or an HTTP date: https://www.rfc-editor.org/rfc/rfc9110#field.retry-after
const retryAfterSeconds = ({ now, value }: RetryAfter): Option.Option<number> => {
  const seconds = Option.filter(Option.map(value, Number), Number.isInteger);

  const untilDate = (at: DateTime.Utc): number =>
    Math.max(noWait, Math.round((DateTime.toEpochMillis(at) - DateTime.toEpochMillis(now)) / millisPerSecond));

  return Option.orElse(seconds, () => Option.map(Option.flatMap(value, DateTime.make), untilDate));
};

export { retryAfterSeconds, signedMessage };
