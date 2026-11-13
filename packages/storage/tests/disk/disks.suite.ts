import { expect } from "@effect/vitest";
import { Array as Arr, Effect, Layer, Predicate, Random } from "effect";
import type { Scope } from "effect";

import type { CheckpointNotFoundError } from "#src/disk/checkpoint-not-found.errors.js";
import type { DiskProviderError } from "#src/disk/disk-provider.errors.js";
import { CheckpointId } from "#src/disk/disk.schema.js";
import type { DiskId } from "#src/disk/disk.schema.js";
import { Disks } from "#src/disk/disks.service.js";
import type { FileNotFoundError } from "#src/disk/file-not-found.errors.js";

const encoder = new globalThis.TextEncoder();

const decoder = new globalThis.TextDecoder();

const RUN_TAG_FLOOR = 0;

const RUN_TAG_LIMIT = 1_000_000_000;

const bytes = (text: string): Uint8Array => encoder.encode(text);

// A disk named for one case and one run, deleted when the case ends, so a real vendor can run the suite again.
const freshDisk = Effect.fn("freshDisk")(function* freshDisk(label: string) {
  const disks = yield* Disks;
  const tag = yield* Random.nextIntBetween(RUN_TAG_FLOOR, RUN_TAG_LIMIT);

  return yield* Effect.acquireRelease(disks.create(`contract-${label}-${tag}`), (disk) =>
    Effect.ignore(disks.delete(disk)),
  );
});

const branchOf = Effect.fn("branchOf")(function* branchOf(checkpoint: CheckpointId, name: string) {
  const disks = yield* Disks;

  return yield* Effect.acquireRelease(disks.branch(checkpoint, name), (disk) => Effect.ignore(disks.delete(disk)));
});

const textAt = Effect.fn("textAt")(function* textAt(disk: DiskId, path: string) {
  const disks = yield* Disks;

  return yield* Effect.map(disks.read(disk, path), (content) => decoder.decode(content));
});

const missingAt = Effect.fn("missingAt")(function* missingAt(disk: DiskId, path: string) {
  const disks = yield* Disks;

  return yield* Effect.match(disks.read(disk, path), {
    onFailure: (failure) => Predicate.isTagged(failure, "FileNotFoundError"),
    onSuccess: () => false,
  });
});

const readsBackAndReplaces = Effect.fn("readsBackAndReplaces")(function* readsBackAndReplaces() {
  const disks = yield* Disks;
  const disk = yield* freshDisk("write");

  yield* disks.write(disk, "notes/today.md", bytes("first"));
  const first = yield* textAt(disk, "notes/today.md");
  yield* disks.write(disk, "notes/today.md", bytes("second, and longer"));

  const second = yield* textAt(disk, "notes/today.md");

  expect(first).toBe("first");
  expect(second).toBe("second, and longer");
});

const failsMissingRead = Effect.fn("failsMissingRead")(function* failsMissingRead() {
  const disks = yield* Disks;
  const disk = yield* freshDisk("missing");
  const never = yield* missingAt(disk, "never-written.txt");

  yield* disks.write(disk, "gone.txt", bytes("soon gone"));
  yield* disks.remove(disk, "gone.txt");
  yield* disks.remove(disk, "gone.txt");

  const gone = yield* missingAt(disk, "gone.txt");

  expect(never).toBe(true);
  expect(gone).toBe(true);
});

const opensSameDisk = Effect.fn("opensSameDisk")(function* opensSameDisk() {
  const disks = yield* Disks;
  const tag = yield* Random.nextIntBetween(RUN_TAG_FLOOR, RUN_TAG_LIMIT);
  const name = `contract-same-${tag}`;
  const disk = yield* Effect.acquireRelease(disks.create(name), (opened) => Effect.ignore(disks.delete(opened)));

  yield* disks.write(disk, "kept.txt", bytes("kept"));

  const again = yield* disks.create(name);
  const kept = yield* textAt(again, "kept.txt");

  expect(again).toBe(disk);
  expect(kept).toBe("kept");
});

const listsFolder = Effect.fn("listsFolder")(function* listsFolder() {
  const disks = yield* Disks;
  const disk = yield* freshDisk("list");

  yield* disks.write(disk, "src/b.ts", bytes("bb"));
  yield* disks.write(disk, "src/deep/a.ts", bytes("a"));
  yield* disks.write(disk, "src2/c.ts", bytes("ccc"));
  yield* disks.write(disk, "srcfile", bytes("dddd"));

  const folder = yield* disks.list(disk, "src");
  const whole = yield* disks.list(disk, "");

  expect(folder).toStrictEqual([
    { path: "src/b.ts", size: 2 },
    { path: "src/deep/a.ts", size: 1 },
  ]);
  expect(Arr.map(whole, (entry) => entry.path)).toStrictEqual(["src/b.ts", "src/deep/a.ts", "src2/c.ts", "srcfile"]);
});

// Writes v1, takes a checkpoint, then changes the disk: v2 and a file the checkpoint never saw.
const changedAfterCheckpoint = Effect.fn("changedAfterCheckpoint")(function* changedAfterCheckpoint() {
  const disks = yield* Disks;
  const disk = yield* freshDisk("restore");

  yield* disks.write(disk, "state.json", bytes("v1"));
  const checkpoint = yield* disks.checkpoint(disk, "before-change");
  yield* disks.write(disk, "state.json", bytes("v2"));
  yield* disks.write(disk, "later.txt", bytes("after the checkpoint"));

  return { checkpoint, disk };
});

const restoresByBranching = Effect.fn("restoresByBranching")(function* restoresByBranching() {
  const { checkpoint, disk } = yield* changedAfterCheckpoint();
  const restored = yield* branchOf(checkpoint, "restored");

  const restoredState = yield* textAt(restored, "state.json");
  const restoredLater = yield* missingAt(restored, "later.txt");
  const originalState = yield* textAt(disk, "state.json");

  expect(restoredState).toBe("v1");
  expect(restoredLater).toBe(true);
  expect(originalState).toBe("v2");
});

// Branches a disk, then writes one file on the parent and another on the branch.
const writtenOnBothSides = Effect.fn("writtenOnBothSides")(function* writtenOnBothSides() {
  const disks = yield* Disks;
  const disk = yield* freshDisk("apart");

  yield* disks.write(disk, "shared.txt", bytes("shared"));
  const checkpoint = yield* disks.checkpoint(disk, "base");
  const branch = yield* branchOf(checkpoint, "session");
  yield* disks.write(disk, "parent-only.txt", bytes("parent"));
  yield* disks.write(branch, "branch-only.txt", bytes("branch"));

  return { branch, checkpoint, disk };
});

const reopen = Effect.fn("reopen")(function* reopen(checkpoint: CheckpointId) {
  const disks = yield* Disks;

  return yield* disks.branch(checkpoint, "session");
});

const keepsBranchApart = Effect.fn("keepsBranchApart")(function* keepsBranchApart() {
  const { branch, checkpoint, disk } = yield* writtenOnBothSides();
  const shared = yield* textAt(branch, "shared.txt");
  const parentOnly = yield* missingAt(branch, "parent-only.txt");
  const branchOnly = yield* missingAt(disk, "branch-only.txt");
  const reopened = yield* reopen(checkpoint);

  expect(branch).not.toBe(disk);
  expect(shared).toBe("shared");
  expect(parentOnly).toBe(true);
  expect(branchOnly).toBe(true);
  expect(reopened).toBe(branch);
});

const refusesUnknownCheckpoint = Effect.fn("refusesUnknownCheckpoint")(function* refusesUnknownCheckpoint() {
  const disks = yield* Disks;
  const disk = yield* freshDisk("unknown");
  const taken = yield* disks.checkpoint(disk, "taken");
  // A checkpoint id the adapter would mint for a name nobody took on this disk.
  const unknown = CheckpointId.make(`${taken}-never`);

  const refused = yield* Effect.match(disks.branch(unknown, "nowhere"), {
    onFailure: (failure) => Predicate.isTagged(failure, "CheckpointNotFoundError"),
    onSuccess: () => false,
  });

  expect(refused).toBe(true);
});

const deletesDisk = Effect.fn("deletesDisk")(function* deletesDisk() {
  const disks = yield* Disks;
  const tag = yield* Random.nextIntBetween(RUN_TAG_FLOOR, RUN_TAG_LIMIT);
  const name = `contract-delete-${tag}`;
  const disk = yield* disks.create(name);

  yield* disks.write(disk, "old.txt", bytes("old"));
  yield* disks.delete(disk);
  yield* disks.delete(disk);
  const again = yield* Effect.acquireRelease(disks.create(name), (opened) => Effect.ignore(disks.delete(opened)));

  const old = yield* missingAt(again, "old.txt");

  expect(old).toBe(true);
});

type Case = () => Effect.Effect<
  void,
  CheckpointNotFoundError | DiskProviderError | FileNotFoundError,
  Disks | Scope.Scope
>;

const cases: readonly (readonly [string, Case])[] = [
  ["reads back what it wrote, and a second write replaces the file", readsBackAndReplaces],
  ["fails a read of a file that was never written, or was removed, with FileNotFoundError", failsMissingRead],
  ["opens the same disk for the same name", opensSameDisk],
  ["lists every file under a folder at any depth, sorted, and nothing beside the folder", listsFolder],
  ["restores a checkpoint by branching from it, leaving later writes on the original", restoresByBranching],
  ["keeps a branch and its parent apart after the branch is taken", keepsBranchApart],
  ["fails a branch from a checkpoint that was never taken with CheckpointNotFoundError", refusesUnknownCheckpoint],
  ["deletes a disk, so the same name later opens an empty disk", deletesDisk],
];

type ProvidedCase<Failure> = () => Effect.Effect<
  void,
  CheckpointNotFoundError | DiskProviderError | FileNotFoundError | Failure
>;

// The behaviour every Disks adapter must show, as named cases with the adapter provided, each on a fresh build of its
// Layer. Run them with it.live, since an adapter may poll its vendor on the real clock.
const disksContract = <Failure>(
  disks: Layer.Layer<Disks, Failure>,
): readonly (readonly [string, ProvidedCase<Failure>])[] =>
  Arr.map(
    cases,
    ([title, run]) =>
      [
        title,
        () => Effect.scoped(Effect.flatMap(Layer.build(disks), (context) => Effect.provideContext(run(), context))),
      ] as const,
  );

export { disksContract };
