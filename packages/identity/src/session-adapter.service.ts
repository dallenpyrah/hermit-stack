import { Context } from "effect";
import type { Effect, Record as Rec } from "effect";

import type { UserId } from "#src/user.id.js";

// A signed-in user as the Session contract sees one: the headers a client sends, and the id the adapter assigned.
interface SignedIn {
  readonly headers: Rec.ReadonlyRecord<string, string>;
  readonly userId: UserId;
}

// What an auth adapter hands the Session contract besides its Session Layer: a way to sign a new user up and in, and a
// Way to expire a session. The contract never sees how the adapter stores either, and the adapter dies on its own
// Failures.
class SessionAdapter extends Context.Service<
  SessionAdapter,
  {
    readonly expire: (signedIn: SignedIn) => Effect.Effect<void>;
    readonly signUp: (name: string) => Effect.Effect<SignedIn>;
  }
>()("@repo/identity/session-adapter.service/SessionAdapter") {}

export { SessionAdapter };

export type { SignedIn };
