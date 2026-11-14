import { Context } from "effect";
import type { Effect, Scope, Stream } from "effect";

import type { DiskId } from "#src/disk/disk.schema.js";

import type { SandboxProviderError } from "./sandbox-provider.errors.js";
import type { Output, SandboxId } from "./sandbox.schema.js";

interface Process {
  readonly output: Stream.Stream<Output, SandboxProviderError>;
  readonly exit: Effect.Effect<number, SandboxProviderError>;
  readonly write: (input: Uint8Array) => Effect.Effect<void, SandboxProviderError>;
}

class Sandboxes extends Context.Service<
  Sandboxes,
  {
    readonly start: (disk: DiskId) => Effect.Effect<SandboxId, SandboxProviderError>;
    readonly run: (sandbox: SandboxId, command: string) => Effect.Effect<Process, SandboxProviderError, Scope.Scope>;
    readonly stop: (sandbox: SandboxId) => Effect.Effect<void, SandboxProviderError>;
  }
>()("@repo/storage/sandbox/sandboxes.service/Sandboxes") {}

export { Sandboxes };

export type { Process };
