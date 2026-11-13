import { Context, Effect, Layer, Option, Schema } from "effect";

import { evaluate } from "#src/evaluate/evaluate.pure.js";
import type { Flag } from "#src/flag/flag.pure.js";
import { FlagStore } from "#src/store/flag-store.service.js";

type Fallback = "invalid-value" | "store-failed";

// A read records its fallback on the caller's span and in the log, then answers with the declared default, so a broken
// Store degrades a request instead of failing it.
const fallBack = <Value>(flag: Flag<Value>, reason: Fallback, cause: unknown): Effect.Effect<Value> =>
  Effect.logWarning(`Flag ${flag.name} fell back to its default`, cause).pipe(
    Effect.annotateLogs({ "feature_flag.fallback": reason, "feature_flag.key": flag.name }),
    Effect.andThen(Effect.annotateCurrentSpan(`feature_flag.fallback.${flag.name}`, reason)),
    Effect.as(flag.default),
  );

class Flags extends Context.Service<
  Flags,
  {
    readonly get: <Value>(flag: Flag<Value>, subject?: string) => Effect.Effect<Value>;
  }
>()("@repo/flags/flags/flags.service/Flags") {
  public static readonly layer: Layer.Layer<Flags, never, FlagStore> = Layer.effect(
    Flags,
    Effect.gen(function* flags() {
      const store = yield* FlagStore;

      return Flags.of({
        // Untraced on purpose: the flag and its value belong on the caller's span, not on a span of their own.
        get: Effect.fnUntraced(function* get<Value>(flag: Flag<Value>, subject?: string) {
          const decode = Schema.decodeUnknownEffect(Schema.toType(flag.schema));

          const value = yield* store.rules(flag).pipe(
            Effect.flatMap(
              Effect.forEach((rule) => Effect.map(decode(rule.value), (decoded) => ({ ...rule, value: decoded }))),
            ),
            Effect.map((rules) => evaluate(flag, rules, Option.fromUndefinedOr(subject))),
            Effect.catchTags({
              FlagStoreError: (error) => fallBack(flag, "store-failed", error),
              SchemaError: (error) => fallBack(flag, "invalid-value", error),
            }),
            Effect.catchDefect((defect) => fallBack(flag, "store-failed", defect)),
          );

          yield* Effect.annotateCurrentSpan(`feature_flag.${flag.name}`, value);

          return value;
        }),
      });
    }),
  );

  public static readonly layerConfig: Layer.Layer<Flags> = Layer.provide(Flags.layer, FlagStore.layerConfig);

  // Reads a flag through the Flags in context: yield* Flags.get(InstantWithdrawals), or with a subject for a rollout.
  public static readonly get = <Value>(flag: Flag<Value>, subject?: string): Effect.Effect<Value, never, Flags> =>
    Flags.use((flags) => flags.get(flag, subject));
}

export { Flags };
