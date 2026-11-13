import { Context } from "effect";
import type { Effect } from "effect";

// Effect's default tracer exports nothing, so a program that never chose a backend would run blind. A host yields
// Telemetry instead, which makes a target that composes no telemetry Layer fail to typecheck.
class Telemetry extends Context.Service<
  Telemetry,
  {
    // Names the backend, such as otlp, axiom or recording, so logs and tests can tell which one a target chose.
    readonly backend: string;
    // Exports everything buffered so far, for a host that is about to be suspended or stopped.
    readonly flush: Effect.Effect<void>;
  }
>()("@repo/telemetry/telemetry.service/Telemetry") {}

export { Telemetry };
