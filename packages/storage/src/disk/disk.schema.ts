import { Schema } from "effect";

const DiskId = Schema.String.pipe(Schema.brand("DiskId"));

type DiskId = typeof DiskId.Type;

const CheckpointId = Schema.String.pipe(Schema.brand("CheckpointId"));

type CheckpointId = typeof CheckpointId.Type;

const FileEntry = Schema.Struct({
  path: Schema.String,
  size: Schema.Int,
});

type FileEntry = typeof FileEntry.Type;

export { CheckpointId, DiskId, FileEntry };
