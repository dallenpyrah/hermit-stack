import { Context } from "effect";
import type { Effect, Redacted } from "effect";

class SigningSecrets extends Context.Service<
  SigningSecrets,
  {
    readonly secretOf: (endpointId: string) => Effect.Effect<Redacted.Redacted>;
  }
>()("@repo/webhook-http/signing-secrets.service/SigningSecrets") {}

export { SigningSecrets };
