import { Effect } from "effect";

export const notifyAll = (emails: ReadonlyArray<string>, send: (email: string) => Effect.Effect<void>) =>
  Effect.forEach(emails, send, { concurrency: "unbounded", discard: true });
