import { Array as Arr, Config, ConfigProvider, Context, Effect, Layer, Option, String as Str, pipe } from "effect";

import type { Rule } from "#src/evaluate/evaluate.pure.js";
import type { Flag } from "#src/flag/flag.pure.js";
import { FlagStoreError } from "#src/store/flag-store.errors.js";

const configName = (flagName: string): string =>
  `FLAG_${pipe(flagName, Str.replaceAll(/[.-]/gu, "_"), Str.toUpperCase)}`;

class FlagStore extends Context.Service<
  FlagStore,
  {
    readonly rules: <Value>(flag: Flag<Value>) => Effect.Effect<readonly Rule<unknown>[], FlagStoreError>;
  }
>()("@repo/flags/store/flag-store.service/FlagStore") {
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
