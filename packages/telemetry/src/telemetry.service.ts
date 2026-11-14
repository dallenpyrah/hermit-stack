import { Context } from "effect";
import type { Effect } from "effect";

class Telemetry extends Context.Service<
  Telemetry,
  {
    readonly backend: string;
    readonly flush: Effect.Effect<void>;
  }
>()("@repo/telemetry/telemetry.service/Telemetry") {}

export { Telemetry };
