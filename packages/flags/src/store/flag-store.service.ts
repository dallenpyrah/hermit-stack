import { Array as Arr, Config, ConfigProvider, Context, Effect, Layer, Option, String as Str, pipe } from "effect";

import type { Rule } from "#src/evaluate/evaluate.pure.js";
import type { Flag } from "#src/flag/flag.pure.js";
import { FlagStoreError } from "#src/store/flag-store.errors.js";

// The Config name of a flag: ledger.instant-withdrawals is FLAG_LEDGER_INSTANT_WITHDRAWALS.
const configName = (flagName: string): string =>
  `FLAG_${pipe(flagName, Str.replaceAll(/[.-]/gu, "_"), Str.toUpperCase)}`;

// Where flag values live. A store returns the rules it holds for a flag, or none, and Flags checks every value against
// The flag's Schema, so a store never needs to know a flag's type.
class FlagStore extends Context.Service<
  FlagStore,
  {
    readonly rules: <Value>(flag: Flag<Value>) => Effect.Effect<readonly Rule<unknown>[], FlagStoreError>;
  }
>()("@repo/flags/store/flag-store.service/FlagStore") {
  // One value per flag from Effect Config, so a value changes with a deploy. A flag with no value reads its default,
  // And a value its Schema rejects is a store failure. The provider is the one current when the layer is built.
  public static readonly layerConfig: Layer.Layer<FlagStore> = Layer.effect(
    FlagStore,
    Effect.gen(function* configFlagStore() {
      const provider = yield* ConfigProvider.ConfigProvider;

      return FlagStore.of({
        rules: (flag) =>
          Config.option(Config.schema(flag.schema, configName(flag.name)))
            .parse(provider)
            .pipe(
              Effect.mapBoth({
                onFailure: (cause) => FlagStoreError.make({ cause, flag: flag.name }),
                onSuccess: Option.match({ onNone: Arr.empty, onSome: (value) => [{ value }] }),
              }),
            ),
      });
    }),
  );
}

export { FlagStore };
