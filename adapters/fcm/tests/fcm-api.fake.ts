import { layerTest } from "@effect/platform-node/NodeHttpServer";
import {
  Array as Arr,
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
import type { HttpServerRequest } from "effect/http";

import { PushVendor } from "@repo/outbound/push-fake";

import { messagingScope } from "#src/service-account.pure.js";

// A local stand-in for Google's token endpoint and FCM's messages:send that answers the way Google documents, so the
// Adapter's real requests are checked against what the vendor would do:
// - Https://developers.google.com/identity/protocols/oauth2/service-account: a form with the jwt-bearer grant and an
//   RS256 assertion whose iss is the service account, scope the messaging scope, aud the token endpoint and exp at
//   Most an hour after iat, answered with { access_token, expires_in, token_type }, or { error, error_description }.
//   That page gives no status for an error; RFC 6749 section 5.2 sets 400 for invalid_grant.
// - Https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send and
//   Https://firebase.google.com/docs/cloud-messaging/send/v1-api: POST /v1/projects/{id}/messages:send with a Bearer
//   Access token and { message }, answered with { name: "projects/{id}/messages/{message_id}" }.
// - Https://firebase.google.com/docs/cloud-messaging/error-codes: the { error: { code, message, status, details } }
//   Body, 404 UNREGISTERED for a token FCM no longer knows and 400 INVALID_ARGUMENT for one that was never valid.
// - Https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#androidnotification: a notification
//   With the tag of one already shown replaces it in the drawer, and without a tag each one is shown anew. The
//   Device this stand-in keeps is that Android drawer.

const accessTokenLifetimeSeconds = 3600;

const ok = 200;

const badRequest = 400;

const unauthorized = 401;

const notFound = 404;

const projectId = "hermit-stack-test";

const clientEmail = `push@${projectId}.iam.gserviceaccount.com`;

const tokenBytes = 32;

// 65537, the public exponent RSA keys use, as JWK writes it.
const publicExponent = Result.getOrElse(Base64Url.decode("AQAB"), () => new Uint8Array());

const rs256 = {
  hash: "SHA-256",
  modulusLength: 2048,
  name: "RSASSA-PKCS1-v1_5",
  publicExponent,
} as const;

const Claims = Schema.fromJsonString(
  Schema.Struct({ aud: Schema.String, exp: Schema.Int, iat: Schema.Int, iss: Schema.String, scope: Schema.String }),
);

const AndroidNotification = Schema.Struct({ tag: Schema.optionalKey(Schema.String) });

const AndroidConfig = Schema.Struct({ notification: Schema.optionalKey(AndroidNotification) });

const Message = Schema.Struct({
  android: Schema.optionalKey(AndroidConfig),
  notification: Schema.Struct({ body: Schema.String, title: Schema.String }),
  token: Schema.String,
});

type Message = typeof Message.Type;

const Send = Schema.fromJsonString(Schema.Struct({ message: Message }));

interface Shown {
  readonly body: string;
  readonly tag: Option.Option<string>;
  readonly title: string;
}

interface Devices {
  readonly accessTokens: HashSet.HashSet<string>;
  readonly forgotten: HashSet.HashSet<string>;
  readonly known: HashMap.HashMap<string, readonly Shown[]>;
  readonly silent: HashSet.HashSet<string>;
}

type Refusal = HttpServerResponse.HttpServerResponse;

const generateKeys = (): Promise<KeyPair> => globalThis.crypto.subtle.generateKey(rs256, true, ["sign", "verify"]);

interface KeyPair {
  readonly privateKey: CryptoKeyOf;
  readonly publicKey: CryptoKeyOf;
}

type CryptoKeyOf = Awaited<ReturnType<typeof globalThis.crypto.subtle.importKey>>;

const randomHex = (bytes: number): string => Hex.encode(globalThis.crypto.getRandomValues(new Uint8Array(bytes)));

const grantError = (description: string): Effect.Effect<never, Refusal> =>
  Effect.fail(
    HttpServerResponse.jsonUnsafe({ error: "invalid_grant", error_description: description }, { status: badRequest }),
  );

interface FcmErrorCode {
  readonly code: number;
  readonly errorCode: string;
  readonly message: string;
  readonly status: string;
}

const fcmError = ({ code, errorCode, message, status }: FcmErrorCode): Effect.Effect<never, Refusal> =>
  Effect.fail(
    HttpServerResponse.jsonUnsafe(
      {
        error: {
          code,
          details: [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode }],
          message,
          status,
        },
      },
      { status: code },
    ),
  );

const verifySignature = Effect.fn("FcmApiFake.verifySignature")(function* verifySignature(
  publicKey: CryptoKeyOf,
  assertion: string,
) {
  const [header, claims = "", signature = ""] = Str.split(assertion, ".");
  const signatureBytes = Result.getOrElse(Base64Url.decode(signature), () => new Uint8Array());
  const content = new globalThis.TextEncoder().encode(`${header}.${claims}`);
  const valid = yield* Effect.promise(() => globalThis.crypto.subtle.verify(rs256, publicKey, signatureBytes, content));

  if (!valid) {
    return yield* grantError("Invalid JWT Signature.");
  }

  const claimsJson = Result.getOrElse(Base64Url.decodeString(claims), Fn.constant(""));

  return yield* Effect.mapError(Schema.decodeEffect(Claims)(claimsJson), () =>
    HttpServerResponse.jsonUnsafe({ error: "invalid_grant" }, { status: badRequest }),
  );
});

// The access token the service account's assertion earns, once its grant, signature and claims pass.
const grant = Effect.fn("FcmApiFake.grant")(function* grant(publicKey: CryptoKeyOf, tokenUrl: string, body: string) {
  const form = new globalThis.URLSearchParams(body);

  if (form.get("grant_type") !== "urn:ietf:params:oauth:grant-type:jwt-bearer") {
    return yield* Effect.fail(
      HttpServerResponse.jsonUnsafe({ error: "unsupported_grant_type" }, { status: badRequest }),
    );
  }

  const claims = yield* verifySignature(publicKey, form.get("assertion") ?? "");
  const scopes = Str.split(claims.scope, " ");

  if (claims.iss !== clientEmail || claims.aud !== tokenUrl || !Arr.contains(scopes, messagingScope)) {
    return yield* grantError("Invalid JWT: the issuer, audience or scope is wrong.");
  }

  if (claims.exp - claims.iat > accessTokenLifetimeSeconds) {
    return yield* grantError("Invalid JWT: Token must be a short-lived token (60 minutes).");
  }

  return `ya29.${randomHex(tokenBytes)}`;
});

const handleToken = (
  devices: Ref.Ref<Devices>,
  publicKey: CryptoKeyOf,
  tokenUrl: string,
): ((request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse>) =>
  Effect.fn("FcmApiFake.handleToken")(
    function* answerToken(request: HttpServerRequest.HttpServerRequest) {
      const body = yield* Effect.orDie(request.text);
      const accessToken = yield* grant(publicKey, tokenUrl, body);

      yield* Ref.update(devices, (state) => ({ ...state, accessTokens: HashSet.add(state.accessTokens, accessToken) }));

      return HttpServerResponse.jsonUnsafe(
        { access_token: accessToken, expires_in: accessTokenLifetimeSeconds, token_type: "Bearer" },
        { status: ok },
      );
    },
    Effect.match({ onFailure: Fn.identity, onSuccess: Fn.identity }),
  );

const checkCaller = (state: Devices, request: HttpServerRequest.HttpServerRequest): Effect.Effect<void, Refusal> => {
  const bearer = Str.replace(/^Bearer /u, "")(request.headers.authorization ?? "");

  if (new globalThis.URL(request.url, "http://fcm").pathname !== `/v1/projects/${projectId}/messages:send`) {
    return Effect.fail(HttpServerResponse.empty({ status: notFound }));
  }

  if (!HashSet.has(state.accessTokens, bearer)) {
    return fcmError({
      code: unauthorized,
      errorCode: "UNAUTHENTICATED",
      message: "Bad token.",
      status: "UNAUTHENTICATED",
    });
  }

  return Effect.void;
};

const checkDevice = (state: Devices, token: string): Effect.Effect<void, Refusal> => {
  if (HashSet.has(state.forgotten, token)) {
    return fcmError({
      code: notFound,
      errorCode: "UNREGISTERED",
      message: "Requested entity was not found.",
      status: "NOT_FOUND",
    });
  }

  if (!HashMap.has(state.known, token)) {
    const message = "The registration token is not a valid FCM registration token";

    return fcmError({ code: badRequest, errorCode: "INVALID_ARGUMENT", message, status: "INVALID_ARGUMENT" });
  }

  if (HashSet.has(state.silent, token)) {
    return Effect.never;
  }

  return Effect.void;
};

// A notification with the tag of one already in the drawer takes its place; any other joins the drawer.
const intoDrawer = (drawer: readonly Shown[], shown: Shown): readonly Shown[] =>
  Option.match(shown.tag, {
    onNone: () => [...drawer, shown],
    onSome: (tag) => [...Arr.filter(drawer, (other) => !Option.contains(other.tag, tag)), shown],
  });

const show = (devices: Ref.Ref<Devices>, message: Message): Effect.Effect<void> => {
  const tag = Option.fromNullishOr(message.android?.notification?.tag);
  const shown = { body: message.notification.body, tag, title: message.notification.title };

  return Ref.update(devices, (state) => ({
    ...state,
    known: HashMap.modify(state.known, message.token, (drawer) => intoDrawer(drawer, shown)),
  }));
};

const handleSend = (
  devices: Ref.Ref<Devices>,
): ((request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse>) =>
  Effect.fn("FcmApiFake.handleSend")(
    function* answerSend(request: HttpServerRequest.HttpServerRequest) {
      const state = yield* Ref.get(devices);

      yield* checkCaller(state, request);

      const body = yield* Effect.orDie(request.text);

      const { message } = yield* Effect.mapError(Schema.decodeEffect(Send)(body), () =>
        HttpServerResponse.empty({ status: badRequest }),
      );

      yield* checkDevice(state, message.token);
      yield* show(devices, message);

      return HttpServerResponse.jsonUnsafe({ name: `projects/${projectId}/messages/0:${randomHex(tokenBytes)}` });
    },
    Effect.match({ onFailure: Fn.identity, onSuccess: Fn.identity }),
  );

const vendorOf = (devices: Ref.Ref<Devices>): PushVendor["Service"] => ({
  forget: (token) => Ref.update(devices, (state) => ({ ...state, forgotten: HashSet.add(state.forgotten, token) })),
  register: Ref.modify(devices, (state) => {
    const token = `${randomHex(tokenBytes)}:APA91b${randomHex(tokenBytes)}`;

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

const pemOf = Effect.fn("FcmApiFake.pemOf")(function* pemOf(privateKey: CryptoKeyOf) {
  const der = yield* Effect.promise(() => globalThis.crypto.subtle.exportKey("pkcs8", privateKey));

  return `-----BEGIN PRIVATE KEY-----\n${Base64.encode(new Uint8Array(der))}\n-----END PRIVATE KEY-----\n`;
});

const noDevices: Devices = {
  accessTokens: HashSet.empty(),
  forgotten: HashSet.empty(),
  known: HashMap.empty(),
  silent: HashSet.empty(),
};

interface Served {
  readonly devices: Ref.Ref<Devices>;
  readonly keys: KeyPair;
}

// The routes, which need the token endpoint's own URL to check the assertion's audience against.
const routesAt = ({ devices, keys }: Served, address: string): Layer.Layer<never, never, HttpServer.HttpServer> => {
  const tokenUrl = `${address}/token`;

  const routes = Layer.mergeAll(
    HttpRouter.add("POST", "/token", handleToken(devices, keys.publicKey, tokenUrl)),
    HttpRouter.add("POST", "/v1/projects/*", handleSend(devices)),
  );

  return HttpRouter.serve(routes, { disableListenLog: true, disableLogger: true });
};

const configAt = (privateKeyPem: string, address: string): Layer.Layer<never> =>
  ConfigProvider.layer(
    ConfigProvider.fromUnknown({
      FCM_BASE_URL: address,
      FCM_CLIENT_EMAIL: clientEmail,
      FCM_PRIVATE_KEY: privateKeyPem,
      FCM_PROJECT_ID: projectId,
      FCM_TIMEOUT: "2 seconds",
      FCM_TOKEN_URL: `${address}/token`,
    }),
  );

// Serves the stand-in on a port the operating system assigns, provides PushVendor over its devices, and sets the
// Config the adapter reads to that address and a service account whose RSA key is made for this run and never kept.
// The adapter's timeout is short, so a send the stand-in never answers fails quickly.
const FcmApiFake = Layer.unwrap(
  Effect.gen(function* fcmApiFake() {
    const devices = yield* Ref.make(noDevices);
    const keys = yield* Effect.promise(generateKeys);
    const privateKeyPem = yield* pemOf(keys.privateKey);

    const around = Layer.unwrap(
      HttpServer.addressFormattedWith((address) =>
        Effect.succeed(Layer.merge(routesAt({ devices, keys }, address), configAt(privateKeyPem, address))),
      ),
    );

    return Layer.merge(Layer.succeed(PushVendor, vendorOf(devices)), around).pipe(
      Layer.provide(layerTest),
      Layer.orDie,
    );
  }),
);

export { FcmApiFake };
