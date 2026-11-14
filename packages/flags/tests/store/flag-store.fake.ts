import { Array as Arr, Effect, Layer, Option, Record as Rec, pipe } from "effect";

import type { Rule } from "#src/evaluate/evaluate.pure.js";
import { FlagStore } from "#src/store/flag-store.service.js";

const FlagStoreFake = (settings: Readonly<Record<string, readonly Rule<unknown>[]>>): Layer.Layer<FlagStore> =>
  Layer.succeed(FlagStore, {
    rules: (flag) => Effect.succeed(pipe(Rec.get(settings, flag.name), Option.getOrElse(Arr.empty))),
  });

export { FlagStoreFake };
