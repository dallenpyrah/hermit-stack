import { Context } from "effect";
import type { Effect, Record as Rec } from "effect";

import type { UserId } from "#src/user.id.js";

interface SignedIn {
  readonly headers: Rec.ReadonlyRecord<string, string>;
  readonly userId: UserId;
}

class SessionAdapter extends Context.Service<
  SessionAdapter,
  {
    readonly expire: (signedIn: SignedIn) => Effect.Effect<void>;
    readonly signUp: (name: string) => Effect.Effect<SignedIn>;
  }
>()("@repo/identity/session-adapter.service/SessionAdapter") {}

export { SessionAdapter };

export type { SignedIn };
