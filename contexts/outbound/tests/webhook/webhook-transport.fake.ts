import type { Identifier } from "@alchemy.run/domain/ExternalSystem";
import {
  Context,
  DateTime,
  Effect,
  HashMap,
  Layer,
  Number as Num,
  Option,
  Record as Rec,
  Ref,
  Result,
  Schema,
  String as Str,
} from "effect";
import { Base64 } from "effect/encoding";
import { NetAddress } from "effect/net";

import { TransportFailed, WebhookTransport } from "#src/webhook/webhook-transport.external.js";

interface ReceivedRequest {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
}

interface ReceiverAnswer {
  readonly headers: Readonly<Record<string, string>>;
  readonly status: number;
}

interface Receiver {
  readonly answerWith: (answer: ReceiverAnswer) => Effect.Effect<void>;
  readonly received: Effect.Effect<readonly ReceivedRequest[]>;
  readonly stopAnswering: Effect.Effect<void>;
  readonly url: string;
  readonly urlAt: (host: string) => string;
}

class WebhookReceivers extends Context.Service<
  WebhookReceivers,
  {
    readonly open: Effect.Effect<Receiver>;
    readonly secretOf: (endpointId: string) => Effect.Effect<string>;
  }
>()("@repo/outbound/tests/webhook/webhook-transport.fake/WebhookReceivers") {}

interface Path {
  readonly answer: Option.Option<ReceiverAnswer>;
  readonly received: readonly ReceivedRequest[];
}

interface Network {
  readonly paths: HashMap.HashMap<string, Path>;
  readonly secrets: HashMap.HashMap<string, string>;
}

const secretPrefix = "whsec_";

const secretBytes = 32;

const publicHost = "hooks.receiver.example";

const millisPerSecond = 1000;

const noWait = 0;

const hmac = { hash: "SHA-256", name: "HMAC" } as const;

const isInternalIpv4 = (address: NetAddress.Ipv4Address): boolean =>
  NetAddress.isLoopback(address) ||
  NetAddress.isUnspecified(address) ||
  NetAddress.isPrivate(address) ||
  NetAddress.isLinkLocal(address);

const isInternal = (address: NetAddress.IpAddress): boolean => {
  if (NetAddress.isIpv4Address(address)) {
    return isInternalIpv4(address);
  }

  return (
    NetAddress.isLoopback(address) ||
    NetAddress.isUnspecified(address) ||
    NetAddress.isLinkLocal(address) ||
    NetAddress.isUniqueLocal(address) ||
    Option.exists(NetAddress.fromIpv4Mapped(address), isInternalIpv4)
  );
};

const isRefused = (hostname: string): boolean => {
  const host = Str.replaceAll(/^\[|\]$/gu, "")(hostname);

  return Option.match(Result.getSuccess(NetAddress.ipFromString(host)), {
    onNone: () => host === "localhost",
    onSome: isInternal,
  });
};

const retryAfterSeconds = (answer: ReceiverAnswer, now: DateTime.Utc): Option.Option<number> => {
  const value = Rec.get(answer.headers, "retry-after");
  const seconds = Option.filter(Option.map(value, Number), Number.isInteger);

  const untilDate = (at: DateTime.Utc): number =>
    Math.max(noWait, Math.round((DateTime.toEpochMillis(at) - DateTime.toEpochMillis(now)) / millisPerSecond));

  return Option.orElse(seconds, () => Option.map(Option.flatMap(value, DateTime.make), untilDate));
};

const WebhookBody = Schema.fromJsonString(
  Schema.Struct({
    data: Schema.Json,
    position: Schema.Int,
    timestamp: Schema.DateTimeUtcFromString,
    type: Schema.String,
  }),
);

const sign = (secret: string, content: string): Effect.Effect<string> =>
  Effect.gen(function* signCase() {
    const bytes = yield* Effect.fromResult(Base64.decode(Str.slice(secretPrefix.length)(secret)));
    const key = yield* Effect.promise(() => globalThis.crypto.subtle.importKey("raw", bytes, hmac, false, ["sign"]));
    const encoded = new globalThis.TextEncoder().encode(content);
    const tag = yield* Effect.promise(() => globalThis.crypto.subtle.sign(hmac, key, encoded));

    return `v1,${Base64.encode(new Uint8Array(tag))}`;
  }).pipe(Effect.orDie);

interface Signing {
  readonly event: {
    readonly id: string;
    readonly occurredAt: DateTime.Utc;
    readonly payload: Schema.Json;
    readonly type: string;
  };
  readonly now: DateTime.Utc;
  readonly position: number;
  readonly secret: string;
}

const signedRequest = Effect.fn("WebhookTransportFake.signedRequest")(function* signedRequest({
  event,
  now,
  position,
  secret,
}: Signing) {
  const timestamp = String(Math.floor(DateTime.toEpochMillis(now) / millisPerSecond));

  const body = yield* Effect.orDie(
    Schema.encodeEffect(WebhookBody)({ data: event.payload, position, timestamp: event.occurredAt, type: event.type }),
  );

  const signature = yield* sign(secret, `${event.id}.${timestamp}.${body}`);

  const headers = {
    "content-type": "application/json",
    "webhook-id": event.id,
    "webhook-signature": signature,
    "webhook-timestamp": timestamp,
  };

  return { body, headers, method: "POST" } satisfies ReceivedRequest;
});

const answerOf = (
  network: Ref.Ref<Network>,
  path: string,
  request: ReceivedRequest,
): Effect.Effect<Option.Option<ReceiverAnswer>> =>
  Ref.modify(network, (state) =>
    Option.match(HashMap.get(state.paths, path), {
      onNone: () => [Option.none<ReceiverAnswer>(), state] as const,
      onSome: (found) => {
        const paths = HashMap.set(state.paths, path, { ...found, received: [...found.received, request] });

        return [found.answer, { ...state, paths }] as const;
      },
    }),
  );

const transport = (
  network: Ref.Ref<Network>,
  secretOf: (endpointId: string) => Effect.Effect<string>,
): Layer.Layer<Identifier<typeof WebhookTransport>> =>
  WebhookTransport.toLayer(
    Effect.succeed({
      post: Effect.fn("WebhookTransportFake.post")(function* post({ endpointId, event, position, url }) {
        const target = new globalThis.URL(url);

        if (isRefused(target.hostname)) {
          return yield* Effect.fail(TransportFailed.make({ reason: `${target.hostname} is not a public address.` }));
        }

        const now = yield* DateTime.now;
        const secret = yield* secretOf(endpointId);
        const request = yield* signedRequest({ event, now, position, secret });
        const answer = yield* answerOf(network, target.pathname, request);

        if (Option.isNone(answer)) {
          return yield* Effect.fail(
            TransportFailed.make({ reason: "The receiver did not answer before the timeout." }),
          );
        }

        return { retryAfterSeconds: retryAfterSeconds(answer.value, now), status: answer.value.status };
      }),
    }),
  );

const ok: ReceiverAnswer = { headers: {}, status: 200 };

const receivers = (network: Ref.Ref<Network>): WebhookReceivers["Service"] => {
  const setPath = (path: string, update: (current: Path) => Path): Effect.Effect<void> =>
    Ref.update(network, (state) => ({ ...state, paths: HashMap.modify(state.paths, path, update) }));

  const receiverAt = (path: string): Receiver => ({
    answerWith: (answer) => setPath(path, (current) => ({ ...current, answer: Option.some(answer) })),
    received: Effect.map(Ref.get(network), (current) =>
      Option.match(HashMap.get(current.paths, path), { onNone: () => [], onSome: (found) => found.received }),
    ),
    stopAnswering: setPath(path, (current) => ({ ...current, answer: Option.none() })),
    url: `https://${publicHost}${path}`,
    urlAt: (host) => `http://${host}${path}`,
  });

  return {
    open: Ref.modify(network, (state) => {
      const path = `/hooks/${Num.increment(HashMap.size(state.paths))}`;
      const paths = HashMap.set(state.paths, path, { answer: Option.some(ok), received: [] });

      return [receiverAt(path), { ...state, paths }];
    }),
    secretOf: (endpointId) =>
      Effect.flatMap(
        Effect.sync(() => globalThis.crypto.getRandomValues(new Uint8Array(secretBytes))),
        (bytes) =>
          Ref.modify(network, (state) =>
            Option.match(HashMap.get(state.secrets, endpointId), {
              onNone: () => {
                const secret = `${secretPrefix}${Base64.encode(bytes)}`;

                return [secret, { ...state, secrets: HashMap.set(state.secrets, endpointId, secret) }] as const;
              },
              onSome: (secret) => [secret, state] as const,
            }),
          ),
      ),
  };
};

const emptyNetwork: Network = { paths: HashMap.empty(), secrets: HashMap.empty() };

const WebhookTransportFake = Layer.unwrap(
  Effect.map(Ref.make(emptyNetwork), (network) => {
    const world = receivers(network);

    return Layer.merge(transport(network, world.secretOf), Layer.succeed(WebhookReceivers, world));
  }),
);

export { WebhookReceivers, WebhookTransportFake };
