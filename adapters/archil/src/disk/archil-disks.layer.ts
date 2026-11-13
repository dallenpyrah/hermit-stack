import { deleteDisk, ensureBranch, ensureDisk, takeCheckpoint } from "@alchemy.run/archil";
import type { DiskStorage } from "@alchemy.run/archil";
import { fromApiKey } from "@distilled.cloud/archil/Credentials";
import type { Credentials } from "@distilled.cloud/archil/Credentials";
import {
  ObjectCredentialsFromApiKey,
  deleteObject,
  getObject,
  listObjects,
  putObject,
} from "@distilled.cloud/archil/Objects";
import type { DiskRef, ObjectCredentials, ObjectSummary } from "@distilled.cloud/archil/Objects";
import {
  CheckpointId,
  CheckpointNotFoundError,
  DiskId,
  DiskProviderError,
  Disks,
  FileNotFoundError,
} from "@repo/storage";
import type { FileEntry } from "@repo/storage";
import { Array as Arr, Effect, Layer, Option, Order, Predicate, Stream, String as Str, pipe } from "effect";
import { FetchHttpClient } from "effect/http";
import type { HttpClient } from "effect/http";

import { addressOf, branchDiskId, checkpointAddressOf, checkpointIdOf, diskNameOf } from "#src/archil-ids.pure.js";
import type { ArchilSettings } from "#src/archil-settings.schema.js";

type Client = Credentials | HttpClient.HttpClient | ObjectCredentials;

type Service = Disks["Service"];

// Runs an Archil call with the client this layer was built with.
type Run = <Success, Failure, Rest>(
  effect: Effect.Effect<Success, Failure, Client | Rest>,
) => Effect.Effect<Success, Failure, Exclude<Rest, Client>>;

// Archil answers through Error subclasses, so their name and message say what went wrong.
const providerError =
  (operation: string) =>
  (failure: Error): DiskProviderError =>
    DiskProviderError.make({ message: `${failure.name}: ${failure.message}`, operation });

const refusal = (operation: string, message: string): Effect.Effect<never, DiskProviderError> =>
  Effect.fail(DiskProviderError.make({ message, operation }));

const refOf = (disk: DiskId): DiskRef => {
  const address = addressOf(disk);

  return Option.match(address.branch, {
    onNone: () => ({ disk: address.disk }),
    onSome: (branch) => ({ branch, disk: address.disk }),
  });
};

// No bucket of the product's own: Archil keeps the files.
const archilManagedStorage = Option.getOrUndefined(Option.none<DiskStorage>());

const byPath = Order.mapInput(Order.String, (entry: FileEntry) => entry.path);

// Archil lists folders as keys ending in "/"; the port lists files only.
const isFile = (summary: ObjectSummary): boolean => !Str.endsWith("/")(summary.key);

const entriesOf = (summaries: readonly ObjectSummary[]): readonly FileEntry[] =>
  pipe(
    summaries,
    Arr.filter(isFile),
    Arr.map((summary): FileEntry => ({ path: summary.key, size: summary.size })),
    Arr.sortBy(byPath),
  );

// An S3 prefix matches any key that starts with it, so a folder's prefix ends in "/" to leave out its neighbours.
const summariesUnder = (disk: DiskId, folder: string): Stream.Stream<ObjectSummary, Error, Client> =>
  Option.match(Option.liftPredicate(folder, Str.isNonEmpty), {
    onNone: () => listObjects(refOf(disk), "", { recursive: true }),
    onSome: (named) => listObjects(refOf(disk), `${named}/`, { recursive: true }),
  });

// Archil's object API answers a missing file with NoSuchKey and its control plane a missing checkpoint with NotFound.
const notFoundAs =
  <Missing>(missing: () => Missing, operation: string) =>
  (failure: Error): DiskProviderError | Missing => {
    if (Predicate.isTagged(failure, "NoSuchKey") || Predicate.isTagged(failure, "NotFound")) {
      return missing();
    }

    return providerError(operation)(failure);
  };

const read =
  (run: Run): Service["read"] =>
  (disk, path) => {
    const content = run(getObject(refOf(disk), path));

    return Effect.mapError(
      content,
      notFoundAs(() => FileNotFoundError.make({ disk, path }), "read"),
    );
  };

const list =
  (run: Run): Service["list"] =>
  (disk, folder) => {
    const summaries = run(Stream.runCollect(summariesUnder(disk, folder)));

    return Effect.mapBoth(summaries, { onFailure: providerError("list"), onSuccess: entriesOf });
  };

const checkpoint =
  (run: Run): Service["checkpoint"] =>
  (disk, name) => {
    const address = addressOf(disk);

    if (Option.isSome(address.branch)) {
      return refusal("checkpoint", "Archil takes run-time checkpoints of a disk's root only, not of a branch.");
    }

    const taken = run(takeCheckpoint(address.disk, name, []));

    return Effect.mapBoth(taken, {
      onFailure: providerError("checkpoint"),
      onSuccess: () => CheckpointId.make(checkpointIdOf({ disk: address.disk, name })),
    });
  };

const branch =
  (run: Run): Service["branch"] =>
  (from, name) =>
    Option.match(checkpointAddressOf(from), {
      onNone: () => Effect.fail(CheckpointNotFoundError.make({ checkpoint: from })),
      onSome: (address) => {
        const opened = run(ensureBranch({ disk: address.disk, fromCheckpoint: address.name, name }));

        return Effect.mapBoth(opened, {
          onFailure: notFoundAs(() => CheckpointNotFoundError.make({ checkpoint: from }), "branch"),
          onSuccess: () => DiskId.make(branchDiskId({ disk: address.disk, name })),
        });
      },
    });

const remove =
  (run: Run): Service["delete"] =>
  (disk) => {
    const address = addressOf(disk);

    if (Option.isSome(address.branch)) {
      return refusal("delete", "Archil has no API to delete a branch; it goes when its disk is deleted.");
    }

    return Effect.mapError(run(deleteDisk(address.disk)), providerError("delete"));
  };

const create =
  (run: Run, prefix: string): Service["create"] =>
  (name) => {
    const ensured = run(ensureDisk(diskNameOf(prefix)(name), archilManagedStorage));

    return Effect.mapBoth(ensured, { onFailure: providerError("create"), onSuccess: (disk) => DiskId.make(disk.id) });
  };

const write =
  (run: Run): Service["write"] =>
  (disk, path, content) => {
    const written = run(putObject(refOf(disk), path, content));

    return written.pipe(Effect.asVoid, Effect.mapError(providerError("write")));
  };

const removeFile =
  (run: Run): Service["remove"] =>
  (disk, path) => {
    const removed = run(deleteObject(refOf(disk), path));

    return Effect.mapError(removed, providerError("remove"));
  };

const serviceOf = (run: Run, prefix: string): Service =>
  Disks.of({
    branch: branch(run),
    checkpoint: checkpoint(run),
    create: create(run, prefix),
    delete: remove(run),
    list: list(run),
    read: read(run),
    remove: removeFile(run),
    write: write(run),
  });

const clientOf = (settings: ArchilSettings): Layer.Layer<Client> => {
  const transport = Layer.mergeAll(ObjectCredentialsFromApiKey, FetchHttpClient.layer);

  return Layer.provideMerge(transport, fromApiKey(settings));
};

// Disks on Archil. Files go through Archil's S3-compatible object API with the account key, and a checkpoint runs
// `archil checkpoints create` in a serverless exec against the disk, as @alchemy.run/archil's Checkpoint does.
const ArchilDisks = (settings: ArchilSettings): Layer.Layer<Disks> => {
  const service = Effect.map(Layer.build(clientOf(settings)), (client) =>
    serviceOf((effect) => Effect.provideContext(effect, client), settings.diskPrefix),
  );

  return Layer.effect(Disks, service);
};

export { ArchilDisks };
