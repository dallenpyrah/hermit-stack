import { Context } from "effect";
import type { Effect, Redacted } from "effect";

// Where the transport reads each endpoint's signing secret: whsec_ and the base64 of a key of 24 to 64 random bytes,
// As Standard Webhooks specifies. Events are kept for good, so the secret never travels with one; the host provides
// This from wherever it keeps secrets.
class SigningSecrets extends Context.Service<
  SigningSecrets,
  {
    readonly secretOf: (endpointId: string) => Effect.Effect<Redacted.Redacted>;
  }
>()("@repo/webhook-http/signing-secrets.service/SigningSecrets") {}

export { SigningSecrets };
