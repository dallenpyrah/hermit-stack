import { createServer } from "node:http2";

import { layer as nodeHttpServer } from "@effect/platform-node/NodeHttpServer";
import {
  Array as Arr,
  Clock,
  ConfigProvider,
  Effect,
  Function as Fn,
  HashMap,
  HashSet,
  Layer,
  Option,
  Ref,
  Result,
  Schema,
  String as Str,
} from "effect";
import { Base64, Base64Url, Hex } from "effect/encoding";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import type { Headers, HttpServerRequest } from "effect/http";

import { PushVendor } from "@repo/outbound/push-fake";

import { ApnsPayload } from "#src/apns-api.schema.js";

// A local stand-in for APNs that answers the way Apple documents, so the adapter's real requests are checked against
// What the vendor would do. It is a cleartext HTTP/2 server with no HTTP/1.1 fallback, so a request that is not HTTP/2
// Gets no answer at all, as from APNs.
// - Https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns: POST
//   /3/device/<token> over HTTP/2, with authorization, apns-topic, apns-push-type, a canonical UUID as apns-id, an
//   Apns-collapse-id of at most 64 bytes and a payload of at most 4096 bytes.
// - Https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns: an
//   ES256 provider token with the Key ID as kid and the Team ID as iss, refused as ExpiredProviderToken (403) once its
//   Iat is more than an hour old.
// - Https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns: 200 with
//   An empty body and the request's apns-id; errors as { "reason" }, 400 BadDeviceToken, 403 InvalidProviderToken,
//   And 410 Unregistered with a timestamp for a token no longer active for the topic.
// - Https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns (apns-collapse-id):
//   Notifications with the same collapse id are shown as one, the newest in place of the older. The device this
//   Stand-in keeps is that notification list.

const ok = 200;

const badRequest = 400;

const forbidden = 403;

const notFound = 404;

const gone = 410;

const payloadTooLarge = 413;

const largestPayload = 4096;

const longestCollapseId = 64;

const providerTokenMaxAgeSeconds = 3600;

const millisPerSecond = 1000;

const tokenBytes = 32;

const keyId = "ABC123DEFG";

const teamId = "DEF123GHIJ";

const topic = "dev.hermit-stack.app";

const p256 = { name: "ECDSA", namedCurve: "P-256" } as const;

const es256 = { hash: "SHA-256", name: "ECDSA" } as const;

const uuidBytes = 16;

const uuidGroups = /^(?<time>.{8})(?<mid>.{4})(?<high>.{4})(?<clock>.{4})(?<node>.{12})$/u;

const canonicalUuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu;

const TokenHeader = Schema.fromJsonString(Schema.Struct({ alg: Schema.Literal("ES256"), kid: Schema.String }));

const TokenClaims = Schema.fromJsonString(Schema.Struct({ iat: Schema.Int, iss: Schema.String }));

const Payload = Schema.fromJsonString(ApnsPayload);

type CryptoKeyOf = Awaited<ReturnType<typeof globalThis.crypto.subtle.importKey>>;

interface KeyPair {
  readonly privateKey: CryptoKeyOf;
  readonly publicKey: CryptoKeyOf;
}

interface Shown {
  readonly body: string;
  readonly collapseId: Option.Option<string>;
  readonly title: string;
}

interface Devices {
  readonly forgotten: HashSet.HashSet<string>;
  readonly known: HashMap.HashMap<string, readonly Shown[]>;
  readonly silent: HashSet.HashSet<string>;
}

type Refusal = HttpServerResponse.HttpServerResponse;

const randomHex = (bytes: number): string => Hex.encode(globalThis.crypto.getRandomValues(new Uint8Array(bytes)));

const generateKeys = (): Promise<KeyPair> => globalThis.crypto.subtle.generateKey(p256, true, ["sign", "verify"]);

const refuse = (status: number, reason: string): Effect.Effect<never, Refusal> =>
  Effect.fail(HttpServerResponse.jsonUnsafe({ reason }, { status }));

const decodePart = <Decoded>(schema: Schema.Codec<Decoded, string>, part: string): Effect.Effect<Decoded, Refusal> => {
  const json = Result.getOrElse(Base64Url.decodeString(part), Fn.constant(""));

  return Effect.mapError(Schema.decodeEffect(schema)(json), () =>
    HttpServerResponse.jsonUnsafe({ reason: "InvalidProviderToken" }, { status: forbidden }),
  );
};

const verifySignature = Effect.fn("ApnsApiFake.verifySignature")(function* verifySignature(
  publicKey: CryptoKeyOf,
  jwt: string,
) {
  const [header, claims = "", signature = ""] = Str.split(jwt, ".");
  const signatureBytes = Result.getOrElse(Base64Url.decode(signature), () => new Uint8Array());
  const content = new globalThis.TextEncoder().encode(`${header}.${claims}`);
  const valid = yield* Effect.promise(() => globalThis.crypto.subtle.verify(es256, publicKey, signatureBytes, content));

  if (!valid) {
    return yield* refuse(forbidden, "InvalidProviderToken");
  }

  const { kid } = yield* decodePart(TokenHeader, header);

  return { claims: yield* decodePart(TokenClaims, claims), kid };
});

// The provider token in the authorization header, signed by the team's key, naming its key and team, under an hour old.
const checkProviderToken = Effect.fn("ApnsApiFake.checkProviderToken")(function* checkProviderToken(
  publicKey: CryptoKeyOf,
  authorization: string,
) {
  if (!Str.startsWith("bearer ")(authorization)) {
    return yield* refuse(forbidden, "MissingProviderToken");
  }

  const { claims, kid } = yield* verifySignature(publicKey, Str.slice("bearer ".length)(authorization));
  const nowMillis = yield* Clock.currentTimeMillis;

  if (kid !== keyId || claims.iss !== teamId) {
    return yield* refuse(forbidden, "InvalidProviderToken");
  }

  if (nowMillis / millisPerSecond - claims.iat > providerTokenMaxAgeSeconds) {
    return yield* refuse(forbidden, "ExpiredProviderToken");
  }

  return yield* Effect.void;
});

// The topic must be the app's and the push type, when given, an alert.
const checkTopic = (headers: Headers.Headers): Effect.Effect<void, Refusal> => {
  const { "apns-push-type": pushType = "alert", "apns-topic": topicHeader = "" } = headers;

  if (Str.isEmpty(topicHeader)) {
    return refuse(badRequest, "MissingTopic");
  }

  if (topicHeader !== topic) {
    return refuse(badRequest, "DeviceTokenNotForTopic");
  }

  if (pushType !== "alert") {
    return refuse(badRequest, "InvalidPushType");
  }

  return Effect.void;
};

// The apns-id the answer echoes, made up as APNs does when the request has none, once it and the collapse id pass.
const checkIds = (headers: Headers.Headers): Effect.Effect<string, Refusal> => {
  const { "apns-collapse-id": collapseId = "" } = headers;
  const apnsId = Option.fromNullishOr(headers["apns-id"]);

  if (Option.exists(apnsId, (id) => !canonicalUuid.test(id))) {
    return refuse(badRequest, "BadMessageId");
  }

  if (new globalThis.TextEncoder().encode(collapseId).length > longestCollapseId) {
    return refuse(badRequest, "BadCollapseId");
  }

  return Effect.succeed(
    Option.getOrElse(apnsId, () =>
      Str.replace(uuidGroups, "$<time>-$<mid>-$<high>-$<clock>-$<node>")(randomHex(uuidBytes)),
    ),
  );
};

const parsePayload = (body: string): Effect.Effect<typeof ApnsPayload.Type, Refusal> => {
  if (Str.isEmpty(body)) {
    return refuse(badRequest, "PayloadEmpty");
  }

  if (new globalThis.TextEncoder().encode(body).length > largestPayload) {
    return refuse(payloadTooLarge, "PayloadTooLarge");
  }

  return Effect.mapError(Schema.decodeEffect(Payload)(body), () =>
    HttpServerResponse.jsonUnsafe({ reason: "BadPayload" }, { status: badRequest }),
  );
};

const checkDevice = Effect.fn("ApnsApiFake.checkDevice")(function* checkDevice(state: Devices, token: string) {
  if (HashSet.has(state.forgotten, token)) {
    const timestamp = yield* Clock.currentTimeMillis;

    return yield* Effect.fail(HttpServerResponse.jsonUnsafe({ reason: "Unregistered", timestamp }, { status: gone }));
  }

  if (!HashMap.has(state.known, token)) {
    return yield* refuse(badRequest, "BadDeviceToken");
  }

  if (HashSet.has(state.silent, token)) {
    return yield* Effect.never;
  }

  return yield* Effect.void;
});

// A notification with the collapse id of one already shown takes its place; any other is shown beside them.
const intoList = (shown: readonly Shown[], notification: Shown): readonly Shown[] =>
  Option.match(notification.collapseId, {
    onNone: () => [...shown, notification],
    onSome: (collapseId) => [
      ...Arr.filter(shown, (other) => !Option.contains(other.collapseId, collapseId)),
      notification,
    ],
  });

interface Delivery {
  readonly notification: Shown;
  readonly token: string;
}

const show = (devices: Ref.Ref<Devices>, { notification, token }: Delivery): Effect.Effect<void> =>
  Ref.update(devices, (state) => ({
    ...state,
    known: HashMap.modify(state.known, token, (shown) => intoList(shown, notification)),
  }));

const tokenOf = (request: HttpServerRequest.HttpServerRequest): Effect.Effect<string, Refusal> => {
  const [, version, device, token = ""] = Str.split(new globalThis.URL(request.url, "http://apns").pathname, "/");

  if (version !== "3" || device !== "device" || Str.isEmpty(token)) {
    return refuse(notFound, "BadPath");
  }

  return Effect.succeed(token);
};

const handleSend = (
  devices: Ref.Ref<Devices>,
  publicKey: CryptoKeyOf,
): ((request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse>) =>
  Effect.fn("ApnsApiFake.handleSend")(
    function* answerSend(request: HttpServerRequest.HttpServerRequest) {
      const token = yield* tokenOf(request);

      yield* checkProviderToken(publicKey, request.headers.authorization ?? "");

      yield* checkTopic(request.headers);

      const apnsId = yield* checkIds(request.headers);
      const { aps } = yield* Effect.flatMap(Effect.orDie(request.text), parsePayload);

      const state = yield* Ref.get(devices);

      yield* checkDevice(state, token);

      const collapseId = Option.fromNullishOr(request.headers["apns-collapse-id"]);

      yield* show(devices, { notification: { ...aps.alert, collapseId }, token });

      return HttpServerResponse.empty({ headers: { "apns-id": apnsId }, status: ok });
    },
    Effect.match({ onFailure: Fn.identity, onSuccess: Fn.identity }),
  );

const vendorOf = (devices: Ref.Ref<Devices>): PushVendor["Service"] => ({
  forget: (token) => Ref.update(devices, (state) => ({ ...state, forgotten: HashSet.add(state.forgotten, token) })),
  register: Ref.modify(devices, (state) => {
    const token = randomHex(tokenBytes);

    return [token, { ...state, known: HashMap.set(state.known, token, []) }];
  }),
  shownOn: (token) =>
    Effect.map(Ref.get(devices), (state) =>
      Arr.map(
        Option.getOrElse(HashMap.get(state.known, token), (): readonly Shown[] => []),
        ({ body, title }) => ({ body, title }),
      ),
    ),
  stopAnsweringFor: (token) => Ref.update(devices, (state) => ({ ...state, silent: HashSet.add(state.silent, token) })),
});

const pemOf = Effect.fn("ApnsApiFake.pemOf")(function* pemOf(privateKey: CryptoKeyOf) {
  const der = yield* Effect.promise(() => globalThis.crypto.subtle.exportKey("pkcs8", privateKey));

  return `-----BEGIN PRIVATE KEY-----\n${Base64.encode(new Uint8Array(der))}\n-----END PRIVATE KEY-----\n`;
});

const noDevices: Devices = { forgotten: HashSet.empty(), known: HashMap.empty(), silent: HashSet.empty() };

const configAt = (privateKeyPem: string, address: string): Layer.Layer<never> =>
  ConfigProvider.layer(
    ConfigProvider.fromUnknown({
      APNS_BASE_URL: address,
      APNS_KEY_ID: keyId,
      APNS_PRIVATE_KEY: privateKeyPem,
      APNS_TEAM_ID: teamId,
      APNS_TIMEOUT: "2 seconds",
      APNS_TOPIC: topic,
    }),
  );

// A cleartext HTTP/2 server on a loopback port the operating system assigns.
const http2Server = nodeHttpServer(() => createServer(), { host: "127.0.0.1", port: 0 });

// Serves the stand-in, provides PushVendor over its devices, and sets the Config the adapter reads to its address and
// A team key made for this run and never kept. The adapter's timeout is short, so a send never answered fails quickly.
const ApnsApiFake = Layer.unwrap(
  Effect.gen(function* apnsApiFake() {
    const devices = yield* Ref.make(noDevices);
    const keys = yield* Effect.promise(generateKeys);
    const privateKeyPem = yield* pemOf(keys.privateKey);
    const routes = HttpRouter.add("*", "/*", handleSend(devices, keys.publicKey));
    const served = HttpRouter.serve(routes, { disableListenLog: true, disableLogger: true });

    const config = Layer.unwrap(
      HttpServer.addressFormattedWith((address) => Effect.succeed(configAt(privateKeyPem, address))),
    );

    return Layer.mergeAll(Layer.succeed(PushVendor, vendorOf(devices)), config, served).pipe(
      Layer.provide(http2Server),
      Layer.orDie,
    );
  }),
);

export { ApnsApiFake };
