import { Array as Arr, Effect, HashMap, Layer, Option, Order, Ref, String as Str, pipe } from "effect";

import { CheckpointNotFoundError } from "#src/disk/checkpoint-not-found.errors.js";
import { DiskProviderError } from "#src/disk/disk-provider.errors.js";
import { CheckpointId, DiskId } from "#src/disk/disk.schema.js";
import type { FileEntry } from "#src/disk/disk.schema.js";
import { Disks } from "#src/disk/disks.service.js";
import { FileNotFoundError } from "#src/disk/file-not-found.errors.js";

type Files = HashMap.HashMap<string, Uint8Array>;

interface State {
  readonly branches: HashMap.HashMap<string, DiskId>;
  readonly checkpoints: HashMap.HashMap<CheckpointId, Files>;
  readonly disks: HashMap.HashMap<DiskId, Files>;
  readonly names: HashMap.HashMap<string, DiskId>;
  readonly next: number;
}

type Store = Ref.Ref<State>;

type Service = Disks["Service"];

type Opened = readonly [DiskId, State];

interface Index {
  readonly key: string;
  readonly lookup: (state: State) => HashMap.HashMap<string, DiskId>;
  readonly register: (state: State, disk: DiskId) => State;
}

const FIRST_ID = 1;

const byPath = Order.mapInput(Order.String, (entry: FileEntry) => entry.path);

const isUnder =
  (folder: string) =>
  (path: string): boolean =>
    Str.isEmpty(folder) || Str.startsWith(`${folder}/`)(path);

// Adds a disk holding these files; ids count up, so every disk in one store is told apart.
const addDisk =
  (files: Files) =>
  (state: State): Opened => {
    const disk = DiskId.make(`memory-disk-${state.next}`);

    return [disk, { ...state, disks: HashMap.set(state.disks, disk, files), next: state.next + FIRST_ID }];
  };

const filesOf =
  (store: Store) =>
  (disk: DiskId): Effect.Effect<Files, DiskProviderError> =>
    Effect.flatMap(Ref.get(store), (state) =>
      Effect.mapError(Effect.fromOption(HashMap.get(state.disks, disk)), () =>
        DiskProviderError.make({ message: `No disk ${disk}.`, operation: "open" }),
      ),
    );

const changeFiles =
  (store: Store, disk: DiskId) =>
  (change: (files: Files) => Files): Effect.Effect<void, DiskProviderError> =>
    Effect.flatMap(filesOf(store)(disk), (files) =>
      Ref.update(store, (state) => ({ ...state, disks: HashMap.set(state.disks, disk, change(files)) })),
    );

// Answers the disk already filed under this key, or adds one and files it there.
const openOnce =
  (index: Index, files: Files) =>
  (state: State): Opened =>
    Option.match(HashMap.get(index.lookup(state), index.key), {
      onNone: () => {
        const [disk, added] = addDisk(files)(state);

        return [disk, index.register(added, disk)];
      },
      onSome: (disk): Opened => [disk, state],
    });

const create =
  (store: Store): Service["create"] =>
  (name) =>
    Ref.modify(
      store,
      openOnce(
        {
          key: name,
          lookup: (state) => state.names,
          register: (state, disk) => ({ ...state, names: HashMap.set(state.names, name, disk) }),
        },
        HashMap.empty(),
      ),
    );

const read =
  (store: Store): Service["read"] =>
  (disk, path) =>
    Effect.flatMap(filesOf(store)(disk), (files) =>
      Effect.mapError(Effect.fromOption(HashMap.get(files, path)), () => FileNotFoundError.make({ disk, path })),
    );

const entryOf =
  (files: Files) =>
  (path: string): FileEntry => ({
    path,
    size: Option.match(HashMap.get(files, path), { onNone: () => Number.NaN, onSome: (bytes) => bytes.byteLength }),
  });

const list =
  (store: Store): Service["list"] =>
  (disk, folder) =>
    Effect.map(filesOf(store)(disk), (files) =>
      pipe(
        Arr.fromIterable(HashMap.keys(files)),
        Arr.filter(isUnder(folder)),
        Arr.map(entryOf(files)),
        Arr.sortBy(byPath),
      ),
    );

const checkpoint =
  (store: Store): Service["checkpoint"] =>
  (disk, name) =>
    Effect.flatMap(filesOf(store)(disk), (files) => {
      const id = CheckpointId.make(`${disk}@${name}`);

      return Effect.flatMap(Ref.get(store), (state) => {
        if (HashMap.has(state.checkpoints, id)) {
          return Effect.fail(
            DiskProviderError.make({ message: `Checkpoint ${name} exists.`, operation: "checkpoint" }),
          );
        }

        return Effect.as(
          Ref.update(store, (latest) => ({ ...latest, checkpoints: HashMap.set(latest.checkpoints, id, files) })),
          id,
        );
      });
    });

const branch =
  (store: Store): Service["branch"] =>
  (from, name) =>
    Effect.flatMap(Ref.get(store), (state) => {
      const frozen = Effect.mapError(Effect.fromOption(HashMap.get(state.checkpoints, from)), () =>
        CheckpointNotFoundError.make({ checkpoint: from }),
      );

      const key = `${from}/${name}`;

      const index: Index = {
        key,
        lookup: (latest) => latest.branches,
        register: (latest, disk) => ({ ...latest, branches: HashMap.set(latest.branches, key, disk) }),
      };

      return Effect.flatMap(frozen, (files) => Ref.modify(store, openOnce(index, files)));
    });

const remove =
  (store: Store): Service["delete"] =>
  (disk) =>
    Ref.update(store, (state) => ({
      ...state,
      branches: HashMap.filter(state.branches, (branched) => branched !== disk),
      disks: HashMap.remove(state.disks, disk),
      names: HashMap.filter(state.names, (named) => named !== disk),
    }));

const serviceOf = (store: Store): Service =>
  Disks.of({
    branch: branch(store),
    checkpoint: checkpoint(store),
    create: create(store),
    delete: remove(store),
    list: list(store),
    read: read(store),
    remove: (disk, path) => changeFiles(store, disk)((files) => HashMap.remove(files, path)),
    write: (disk, path, content) => changeFiles(store, disk)((files) => HashMap.set(files, path, content)),
  });

const emptyState: State = {
  branches: HashMap.empty(),
  checkpoints: HashMap.empty(),
  disks: HashMap.empty(),
  names: HashMap.empty(),
  next: FIRST_ID,
};

// Disks kept in memory. A branch copies its checkpoint's files, so later writes on either side stay on that side.
const DisksFake: Layer.Layer<Disks> = Layer.effect(Disks, Effect.map(Ref.make(emptyState), serviceOf));

export { DisksFake };
