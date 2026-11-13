import { Schema } from "effect";

// The adapter that created a disk chooses its id's format, so callers store it and hand it back but never parse it.
const DiskId = Schema.String.pipe(Schema.brand("DiskId"));

type DiskId = typeof DiskId.Type;

// A checkpoint is named by the adapter too: one id is enough to branch from it later, whichever disk it came from.
const CheckpointId = Schema.String.pipe(Schema.brand("CheckpointId"));

type CheckpointId = typeof CheckpointId.Type;

// A path is relative to the disk's root and uses "/" between folders, such as "notes/today.md".
const FileEntry = Schema.Struct({
  path: Schema.String,
  size: Schema.Int,
});

type FileEntry = typeof FileEntry.Type;

export { CheckpointId, DiskId, FileEntry };
