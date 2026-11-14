import { Context } from "effect";
import type { Effect } from "effect";

import type { CheckpointNotFoundError } from "./checkpoint-not-found.errors.js";
import type { DiskProviderError } from "./disk-provider.errors.js";
import type { FileNotFoundError } from "./file-not-found.errors.js";
import type { CheckpointId, DiskId, FileEntry } from "./disk.schema.js";

class Disks extends Context.Service<
  Disks,
  {
    readonly create: (name: string) => Effect.Effect<DiskId, DiskProviderError>;
    readonly read: (disk: DiskId, path: string) => Effect.Effect<Uint8Array, FileNotFoundError | DiskProviderError>;
    readonly write: (disk: DiskId, path: string, content: Uint8Array) => Effect.Effect<void, DiskProviderError>;
    readonly list: (disk: DiskId, folder: string) => Effect.Effect<readonly FileEntry[], DiskProviderError>;
    readonly remove: (disk: DiskId, path: string) => Effect.Effect<void, DiskProviderError>;
    readonly checkpoint: (disk: DiskId, name: string) => Effect.Effect<CheckpointId, DiskProviderError>;
    readonly branch: (
      checkpoint: CheckpointId,
      name: string,
    ) => Effect.Effect<DiskId, CheckpointNotFoundError | DiskProviderError>;
    readonly delete: (disk: DiskId) => Effect.Effect<void, DiskProviderError>;
  }
>()("@repo/storage/disk/disks.service/Disks") {}

export { Disks };
