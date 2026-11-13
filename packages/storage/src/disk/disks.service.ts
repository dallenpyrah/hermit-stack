import { Context } from "effect";
import type { Effect } from "effect";

import type { CheckpointNotFoundError } from "./checkpoint-not-found.errors.js";
import type { DiskProviderError } from "./disk-provider.errors.js";
import type { FileNotFoundError } from "./file-not-found.errors.js";
import type { CheckpointId, DiskId, FileEntry } from "./disk.schema.js";

// Durable disks the application reads and writes as files. A checkpoint freezes a disk as it is, and a branch is a new,
// Independent disk that starts from a checkpoint; writes to either side never reach the other. There is no restore in
// Place: to go back to a checkpoint, branch from it and use the branch.
class Disks extends Context.Service<
  Disks,
  {
    // Opens the disk with this name, creating it the first time, so the same name always reaches the same disk.
    readonly create: (name: string) => Effect.Effect<DiskId, DiskProviderError>;
    readonly read: (disk: DiskId, path: string) => Effect.Effect<Uint8Array, FileNotFoundError | DiskProviderError>;
    // Creates the file, and any folders above it, or replaces it.
    readonly write: (disk: DiskId, path: string, content: Uint8Array) => Effect.Effect<void, DiskProviderError>;
    // Every file under the folder, at any depth, sorted by path. An empty folder name lists the whole disk.
    readonly list: (disk: DiskId, folder: string) => Effect.Effect<readonly FileEntry[], DiskProviderError>;
    // Removing a file that does not exist succeeds.
    readonly remove: (disk: DiskId, path: string) => Effect.Effect<void, DiskProviderError>;
    // Names must be unique on a disk; a checkpoint never changes once taken.
    readonly checkpoint: (disk: DiskId, name: string) => Effect.Effect<CheckpointId, DiskProviderError>;
    // Opens the branch with this name, creating it from the checkpoint the first time.
    readonly branch: (
      checkpoint: CheckpointId,
      name: string,
    ) => Effect.Effect<DiskId, CheckpointNotFoundError | DiskProviderError>;
    // Deletes the disk and its files. Deleting a disk that does not exist succeeds.
    readonly delete: (disk: DiskId) => Effect.Effect<void, DiskProviderError>;
  }
>()("@repo/storage/disk/disks.service/Disks") {}

export { Disks };
