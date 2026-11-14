import { Effect, Redacted, Schema, String as Str } from "effect";
import { Base64, Base64Url } from "effect/encoding";

const millisPerSecond = 1000;

const p256 = { name: "ECDSA", namedCurve: "P-256" } as const;

const es256 = { hash: "SHA-256", name: "ECDSA" } as const;

// A .p8 key as Apple hands it out, with its line breaks either real or written as \n.
const pemDecoration = /-----[^-]+-----|\\n|\s/gu;

const JsonText = Schema.fromJsonString(Schema.Json);

const encodedJson = (value: Schema.Json): Effect.Effect<string> =>
  Effect.map(Effect.orDie(Schema.encodeEffect(JsonText)(value)), Base64Url.encode);

const derOf = (pem: Redacted.Redacted): Effect.Effect<Uint8Array> => {
  const base64 = Str.replaceAll(pemDecoration, "")(Redacted.value(pem));

  return Effect.orDie(Effect.fromResult(Base64.decode(base64)));
};

interface ProviderKey {
  readonly keyId: string;
  readonly nowMillis: number;
  readonly privateKey: Redacted.Redacted;
  readonly teamId: string;
}

// The provider token APNs takes in place of a certificate: a JWT signed with ES256 under the team's .p8 key, its Key
// ID in the header and the Team ID and the time it was made in the claims. WebCrypto's ECDSA signature is the raw r
// And s that JWS expects. https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns
const providerToken = Effect.fn("ProviderToken.providerToken")(function* providerToken({
  keyId,
  nowMillis,
  privateKey,
  teamId,
}: ProviderKey) {
  const header = yield* encodedJson({ alg: "ES256", kid: keyId });
  const claims = yield* encodedJson({ iat: Math.floor(nowMillis / millisPerSecond), iss: teamId });
  const unsigned = `${header}.${claims}`;
  const der = yield* derOf(privateKey);
  const key = yield* Effect.promise(() => globalThis.crypto.subtle.importKey("pkcs8", der, p256, false, ["sign"]));
  const content = new globalThis.TextEncoder().encode(unsigned);
  const signature = yield* Effect.promise(() => globalThis.crypto.subtle.sign(es256, key, content));

  return `${unsigned}.${Base64Url.encode(new Uint8Array(signature))}`;
});

export { providerToken };
