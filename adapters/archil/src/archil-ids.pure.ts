import { Option, String as Str, pipe } from "effect";

interface DiskAddress {
  readonly disk: string;
  readonly branch: Option.Option<string>;
}

interface CheckpointAddress {
  readonly disk: string;
  readonly name: string;
}

const BRANCH_SEPARATOR = ".";

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

const diskNameOf =
  (prefix: string) =>
  (name: string): string =>
    `${prefix}-${name}`;

export { addressOf, branchDiskId, checkpointAddressOf, checkpointIdOf, diskNameOf };

export type { CheckpointAddress, DiskAddress };
