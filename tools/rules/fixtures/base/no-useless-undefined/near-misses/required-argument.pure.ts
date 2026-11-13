import { Deferred } from "effect";
import type { Effect } from "effect";

declare const deferred: Deferred.Deferred<void>;

export const signal: Effect.Effect<boolean> = Deferred.succeed(deferred, undefined);
