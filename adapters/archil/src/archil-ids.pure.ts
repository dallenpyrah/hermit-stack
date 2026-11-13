import { Option, String as Str, pipe } from "effect";

// Where a port's disk id points on Archil: a disk, or one of its branches.
interface DiskAddress {
  readonly disk: string;
  readonly branch: Option.Option<string>;
}

interface CheckpointAddress {
  readonly disk: string;
  readonly name: string;
}

// Archil names a branch's bucket "<disk id>.<branch name>", and its disk ids ("dsk-…") hold no dot, so a port disk id
// Uses the same form: a root disk is its Archil id, a branch is that bucket name.
const BRANCH_SEPARATOR = ".";

// A checkpoint is named per disk, and a run-time checkpoint is always of a disk's root.
const CHECKPOINT_SEPARATOR = "@";

const AFTER_SEPARATOR = 1;

const START = 0;

const splitAt = (separator: string, text: string): Option.Option<readonly [string, string]> =>
  Option.map(Str.indexOf(separator)(text), (index) => [
    Str.slice(START, index)(text),
    Str.slice(index + AFTER_SEPARATOR)(text),
  ]);

const addressOf = (diskId: string): DiskAddress =>
  Option.match(splitAt(BRANCH_SEPARATOR, diskId), {
    onNone: () => ({ branch: Option.none(), disk: diskId }),
    onSome: ([disk, branch]) => ({ branch: Option.some(branch), disk }),
  });

const branchDiskId = (address: CheckpointAddress): string => `${address.disk}${BRANCH_SEPARATOR}${address.name}`;

const checkpointIdOf = (address: CheckpointAddress): string => `${address.disk}${CHECKPOINT_SEPARATOR}${address.name}`;

const checkpointAddressOf = (checkpointId: string): Option.Option<CheckpointAddress> =>
  pipe(
    splitAt(CHECKPOINT_SEPARATOR, checkpointId),
    Option.map(([disk, name]) => ({ disk, name })),
  );

// The Archil disk name for a port disk name. One prefix per product and stage keeps their disks apart in one account,
// And an infra stack that declares a disk with this name hands it to the running program's create(name).
const diskNameOf =
  (prefix: string) =>
  (name: string): string =>
    `${prefix}-${name}`;

export { addressOf, branchDiskId, checkpointAddressOf, checkpointIdOf, diskNameOf };

export type { CheckpointAddress, DiskAddress };
