import { Effect, Redacted, Schema, String as Str } from "effect";
import { Base64, Base64Url } from "effect/encoding";

const millisPerSecond = 1000;

const assertionLifetimeSeconds = 3600;

const messagingScope = "https://www.googleapis.com/auth/firebase.messaging";

const rs256 = { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" } as const;

const pemDecoration = /-----[^-]+-----|\\n|\s/gu;

interface Assertion {
  readonly clientEmail: string;
  readonly nowMillis: number;
  readonly privateKey: Redacted.Redacted;
  readonly tokenUrl: string;
}

const JsonText = Schema.fromJsonString(Schema.Json);

const encodedJson = (value: Schema.Json): Effect.Effect<string> =>
  Effect.map(Effect.orDie(Schema.encodeEffect(JsonText)(value)), Base64Url.encode);

const derOf = (pem: Redacted.Redacted): Effect.Effect<Uint8Array> => {
  const base64 = Str.replaceAll(pemDecoration, "")(Redacted.value(pem));

  return Effect.orDie(Effect.fromResult(Base64.decode(base64)));
};

const signedAssertion = Effect.fn("ServiceAccount.signedAssertion")(function* signedAssertion({
  clientEmail,
  nowMillis,
  privateKey,
  tokenUrl,
}: Assertion) {
  const iat = Math.floor(nowMillis / millisPerSecond);
  const claims = { aud: tokenUrl, exp: iat + assertionLifetimeSeconds, iat, iss: clientEmail, scope: messagingScope };
  const header = yield* encodedJson({ alg: "RS256", typ: "JWT" });
  const payload = yield* encodedJson(claims);
  const unsigned = `${header}.${payload}`;
  const der = yield* derOf(privateKey);
  const key = yield* Effect.promise(() => globalThis.crypto.subtle.importKey("pkcs8", der, rs256, false, ["sign"]));
  const content = new globalThis.TextEncoder().encode(unsigned);
  const signature = yield* Effect.promise(() => globalThis.crypto.subtle.sign(rs256, key, content));

  return `${unsigned}.${Base64Url.encode(new Uint8Array(signature))}`;
});

export { messagingScope, signedAssertion };
