import { Context } from "effect";
import type { Effect, Scope, Stream } from "effect";

import type { DiskId } from "#src/disk/disk.schema.js";

import type { SandboxProviderError } from "./sandbox-provider.errors.js";
import type { Output, SandboxId } from "./sandbox.schema.js";

// A command running in a sandbox. Its output can be read while it runs and ends when the command ends; waiting for the
// Exit code does not consume the output, so either may come first.
interface Process {
  readonly output: Stream.Stream<Output, SandboxProviderError>;
  readonly exit: Effect.Effect<number, SandboxProviderError>;
  readonly write: (input: Uint8Array) => Effect.Effect<void, SandboxProviderError>;
}

// Machines that run shell commands against a disk. A command starts in the disk's root folder, sees the disk's files,
// And what it writes there stays on the disk after the sandbox stops.
class Sandboxes extends Context.Service<
  Sandboxes,
  {
    readonly start: (disk: DiskId) => Effect.Effect<SandboxId, SandboxProviderError>;
    // Closing the scope detaches from the command; it does not wait for it to end.
    readonly run: (sandbox: SandboxId, command: string) => Effect.Effect<Process, SandboxProviderError, Scope.Scope>;
    // Stops and removes the sandbox. Stopping one that is already gone succeeds.
    readonly stop: (sandbox: SandboxId) => Effect.Effect<void, SandboxProviderError>;
  }
>()("@repo/storage/sandbox/sandboxes.service/Sandboxes") {}

export { Sandboxes };

export type { Process };
