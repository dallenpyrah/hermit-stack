import type { ApiResponseCreateDiskData, BranchResponse, DiskResponse, ExecDiskResult } from "@distilled.cloud/archil";
import {
  Array as Arr,
  Effect,
  FileSystem,
  HashMap,
  Layer,
  Option,
  Order,
  Path,
  Ref,
  Schema,
  Stream,
  String as Str,
  pipe,
} from "effect";
import type { PlatformError } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { HttpServerError } from "effect/http";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

// The disk half of a local stand-in for Archil's HTTP API: the control plane's disk, branch and exec routes, and the
// S3-compatible object routes of its data plane, path-style, with the bucket a disk id or "<disk id>.<branch>". Each
// Disk is a folder on the machine running the test, so the sandbox half can run real shell commands against it.

interface Disk {
  readonly id: string;
  readonly name: string;
}

interface Branch {
  readonly disk: string;
  readonly name: string;
  readonly checkpoint: string;
}

interface Registry {
  readonly next: number;
  readonly disks: HashMap.HashMap<string, Disk>;
  readonly branches: HashMap.HashMap<string, Branch>;
}

interface StandIn {
  readonly files: FileSystem.FileSystem;
  readonly paths: Path.Path;
  readonly registry: Ref.Ref<Registry>;
  readonly root: string;
  readonly spawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
}

// What the disk routes answer inside Archil's envelope, in the SDK's own types.
type Answer = ApiResponseCreateDiskData | BranchResponse | DiskResponse | ExecDiskResult | readonly DiskResponse[];

type Failure = HttpServerError.HttpServerError | PlatformError.PlatformError | Schema.SchemaError;

type Handler = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  Failure,
  HttpServerRequest.HttpServerRequest | HttpServerRequest.ParsedSearchParams | HttpRouter.RouteContext
>;

// What the routes need from the server that serves them: a router, and a way to answer a route that failed.
type Routes = Layer.Layer<never, never, HttpRouter.HttpRouter | HttpRouter.Request<"Error", Failure>>;

const NOT_FOUND = 404;

const NO_CONTENT = 204;

const OK = 200;

// The exec's three output pipes are read side by side, so a full one never stalls the script.
const PIPES = 3;

const NEXT_ID = 1;

const NO_TIME = 0;

const CREATED_AT = "2026-01-01T00:00:00.000Z";

// Where Archil mounts a disk in its serverless exec, and so the path an exec script names it by.
const MOUNT_PATH = "/mnt/archil";

// Archil's exec image has an `archil` command whose `checkpoints create <path> <name>` freezes the disk. The stand-in
// Copies the disk's folder aside instead, and refuses a name the disk already used.
const ARCHIL_COMMAND = `archil() {
  [ "$1 $2" = "checkpoints create" ] && [ ! -e "$ARCHIL_CHECKPOINTS/$4" ] &&
    mkdir -p "$ARCHIL_CHECKPOINTS" && cp -R "$3" "$ARCHIL_CHECKPOINTS/$4"
}`;

// Where a bucket's files live on the machine running the test.
const bucketPath =
  (root: string) =>
  (bucket: string): string =>
    `${root}/disks/${bucket}`;

const checkpointsPath = (root: string, disk: string): string => `${root}/checkpoints/${disk}`;

// Archil wraps every control-plane answer in this envelope.
const ok = (answer: Answer): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.jsonUnsafe({ data: answer, success: true });

const missing = (what: string): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.jsonUnsafe({ error: `${what} not found`, success: false }, { status: NOT_FOUND });

const s3Error = (code: string, status: number): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.text(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code></Error>`, {
    contentType: "application/xml",
    status,
  });

const diskJson = (disk: Disk): DiskResponse => ({
  createdAt: CREATED_AT,
  id: disk.id,
  name: disk.name,
  organization: "stand-in",
  provider: "aws",
  region: "aws-us-east-1",
  status: "available",
});

const branchJson = (branch: Branch): BranchResponse => ({
  branch_name: branch.name,
  created_at: CREATED_AT,
  filesystem_id: `${branch.disk}.${branch.name}`,
  from_checkpoint_filesystem_id: `${branch.disk}@${branch.checkpoint}`,
  from_checkpoint_name: branch.checkpoint,
  root_filesystem_id: branch.disk,
});

const DiskParams = Schema.Struct({ id: Schema.String });

const BranchParams = Schema.Struct({ id: Schema.String, name: Schema.String });

const ListDisks = Schema.Struct({ name: Schema.optionalKey(Schema.String) });

const ListObjects = Schema.Struct({ prefix: Schema.optionalKey(Schema.String) });

const ObjectParams = Schema.Struct({ "*": Schema.String, bucket: Schema.String });

const diskOf = (standIn: StandIn, id: string): Effect.Effect<Option.Option<Disk>> =>
  Effect.map(Ref.get(standIn.registry), (registry) => HashMap.get(registry.disks, id));

const listDisks = (standIn: StandIn): Handler =>
  Effect.gen(function* listDisksRoute() {
    const search = yield* HttpServerRequest.schemaSearchParams(ListDisks);
    const registry = yield* Ref.get(standIn.registry);
    const wanted = Option.fromNullishOr(search.name);

    const disks = pipe(
      HashMap.toValues(registry.disks),
      Arr.filter((disk) => Option.match(wanted, { onNone: () => true, onSome: (name) => name === disk.name })),
      Arr.map(diskJson),
    );

    return ok(disks);
  });

// Archil answers a create of a name it already has with that disk's id.
const register =
  (name: string) =>
  (registry: Registry): readonly [Disk, Registry] => {
    const found = Arr.findFirst(HashMap.toValues(registry.disks), (disk) => disk.name === name);

    return Option.match(found, {
      onNone: () => {
        const disk = { id: `dsk-${registry.next}`, name };

        return [
          disk,
          { ...registry, disks: HashMap.set(registry.disks, disk.id, disk), next: registry.next + NEXT_ID },
        ];
      },
      onSome: (disk) => [disk, registry],
    });
  };

const createDisk = (standIn: StandIn): Handler =>
  Effect.gen(function* createDiskRoute() {
    const body = yield* HttpServerRequest.schemaBodyJson(Schema.Struct({ name: Schema.String }));
    const disk = yield* Ref.modify(standIn.registry, register(body.name));

    yield* standIn.files.makeDirectory(bucketPath(standIn.root)(disk.id), { recursive: true });

    return ok({ diskId: disk.id });
  });

const getDisk = (standIn: StandIn): Handler =>
  Effect.gen(function* getDiskRoute() {
    const { id } = yield* HttpRouter.schemaPathParams(DiskParams);
    const disk = yield* diskOf(standIn, id);

    return Option.match(disk, { onNone: () => missing("Disk"), onSome: (found) => ok(diskJson(found)) });
  });

const forget =
  (id: string) =>
  (registry: Registry): Registry => ({
    ...registry,
    branches: HashMap.filter(registry.branches, (branch) => branch.disk !== id),
    disks: HashMap.remove(registry.disks, id),
  });

// Deleting a disk takes its branches and checkpoints with it, as on Archil.
const deleteDisk = (standIn: StandIn): Handler =>
  Effect.gen(function* deleteDiskRoute() {
    const { id } = yield* HttpRouter.schemaPathParams(DiskParams);
    const disk = yield* diskOf(standIn, id);
    const registry = yield* Ref.get(standIn.registry);
    const buckets = pipe(HashMap.keys(registry.branches), Arr.fromIterable, Arr.filter(Str.startsWith(`${id}.`)));

    const doomed = [
      bucketPath(standIn.root)(id),
      checkpointsPath(standIn.root, id),
      ...Arr.map(buckets, bucketPath(standIn.root)),
    ];

    yield* Effect.forEach(doomed, (path) => standIn.files.remove(path, { force: true, recursive: true }));
    yield* Ref.update(standIn.registry, forget(id));

    return Option.match(disk, {
      onNone: () => missing("Disk"),
      onSome: () => HttpServerResponse.jsonUnsafe({ success: true }),
    });
  });

const textOf = (
  output: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
): Effect.Effect<string, PlatformError.PlatformError> => Stream.mkString(Stream.decodeText(output));

// Runs an exec script in the disk's folder, which stands where Archil would mount the disk.
const runScript = (
  standIn: StandIn,
  id: string,
  command: string,
): Effect.Effect<ExecDiskResult, PlatformError.PlatformError> =>
  Effect.scoped(
    Effect.gen(function* runScriptInFolder() {
      const folder = bucketPath(standIn.root)(id);
      const script = `${ARCHIL_COMMAND}\n${Str.replaceAll(MOUNT_PATH, folder)(command)}`;
      const env = { ARCHIL_CHECKPOINTS: checkpointsPath(standIn.root, id) };

      const handle = yield* standIn.spawner.spawn(
        ChildProcess.make("sh", ["-c", script], { cwd: folder, env, extendEnv: true }),
      );

      const [stdout, stderr, exitCode] = yield* Effect.all(
        [textOf(handle.stdout), textOf(handle.stderr), handle.exitCode],
        { concurrency: PIPES },
      );

      return { exitCode, stderr, stdout, timing: { executeMs: NO_TIME, queueMs: NO_TIME, totalMs: NO_TIME } };
    }),
  );

const execDisk = (standIn: StandIn): Handler =>
  Effect.gen(function* execDiskRoute() {
    const { id } = yield* HttpRouter.schemaPathParams(DiskParams);
    const body = yield* HttpServerRequest.schemaBodyJson(Schema.Struct({ command: Schema.String }));
    const disk = yield* diskOf(standIn, id);

    if (Option.isNone(disk)) {
      return missing("Disk");
    }

    const result = yield* runScript(standIn, id, body.command);

    return ok(result);
  });

const getBranch = (standIn: StandIn): Handler =>
  Effect.gen(function* getBranchRoute() {
    const { id, name } = yield* HttpRouter.schemaPathParams(BranchParams);
    const registry = yield* Ref.get(standIn.registry);
    const branch = HashMap.get(registry.branches, `${id}.${name}`);

    return Option.match(branch, { onNone: () => missing("Branch"), onSome: (found) => ok(branchJson(found)) });
  });

const CreateBranch = Schema.Struct({ branch_name: Schema.String, from_checkpoint_name: Schema.String });

// A branch starts as a copy of the checkpoint's folder and changes apart from its disk from then on.
const openBranch = (standIn: StandIn, branch: Branch): Handler =>
  Effect.gen(function* openBranchFolder() {
    const frozen = `${checkpointsPath(standIn.root, branch.disk)}/${branch.checkpoint}`;
    const bucket = `${branch.disk}.${branch.name}`;
    const taken = yield* standIn.files.exists(frozen);

    if (!taken) {
      return missing("Checkpoint");
    }

    yield* standIn.files.copy(frozen, bucketPath(standIn.root)(bucket));
    yield* Ref.update(standIn.registry, (registry) => ({
      ...registry,
      branches: HashMap.set(registry.branches, bucket, branch),
    }));

    return ok(branchJson(branch));
  });

const createBranch = (standIn: StandIn): Handler =>
  Effect.gen(function* createBranchRoute() {
    const { id } = yield* HttpRouter.schemaPathParams(DiskParams);
    const body = yield* HttpServerRequest.schemaBodyJson(CreateBranch);

    return yield* openBranch(standIn, { checkpoint: body.from_checkpoint_name, disk: id, name: body.branch_name });
  });

// A path that is missing, or names a folder, holds no object.
const isFile = (standIn: StandIn, path: string): Effect.Effect<boolean> =>
  Effect.map(
    Effect.option(standIn.files.stat(path)),
    Option.exists((entry) => entry.type === "File"),
  );

const getObject = (standIn: StandIn, path: string): Handler =>
  Effect.gen(function* getObjectRoute() {
    const found = yield* isFile(standIn, path);

    if (!found) {
      return s3Error("NoSuchKey", NOT_FOUND);
    }

    const content = yield* standIn.files.readFile(path);

    return HttpServerResponse.uint8Array(content);
  });

const writeObject = (
  standIn: StandIn,
  path: string,
  content: Uint8Array,
): Effect.Effect<void, PlatformError.PlatformError> =>
  Effect.andThen(
    standIn.files.makeDirectory(standIn.paths.dirname(path), { recursive: true }),
    standIn.files.writeFile(path, content),
  );

const putObject = (standIn: StandIn): Handler =>
  Effect.gen(function* putObjectRoute() {
    const params = yield* HttpRouter.schemaPathParams(ObjectParams);
    const request = yield* HttpServerRequest.HttpServerRequest;
    const bucket = bucketPath(standIn.root)(params.bucket);
    const received = yield* request.arrayBuffer;
    const opened = yield* standIn.files.exists(bucket);

    if (!opened) {
      return s3Error("NoSuchBucket", NOT_FOUND);
    }

    yield* writeObject(standIn, `${bucket}/${params["*"]}`, new Uint8Array(received));

    return HttpServerResponse.empty({ headers: { etag: `"${received.byteLength}"` }, status: OK });
  });

const deleteObject = (standIn: StandIn): Handler =>
  Effect.gen(function* deleteObjectRoute() {
    const params = yield* HttpRouter.schemaPathParams(ObjectParams);

    yield* standIn.files.remove(`${bucketPath(standIn.root)(params.bucket)}/${params["*"]}`, { force: true });

    return HttpServerResponse.empty({ status: NO_CONTENT });
  });

const contentsOf = (
  standIn: StandIn,
  bucket: string,
  key: string,
): Effect.Effect<string, PlatformError.PlatformError> =>
  Effect.map(
    standIn.files.stat(`${bucket}/${key}`),
    (entry) => `<Contents><Key>${key}</Key><Size>${entry.size}</Size></Contents>`,
  );

// ListObjectsV2 without a delimiter, the recursive listing the adapter asks for: every file whose key starts with the
// Prefix, in key order, on one page.
const listObjects = (standIn: StandIn, bucket: string): Handler =>
  Effect.gen(function* listObjectsRoute() {
    const search = yield* HttpServerRequest.schemaSearchParams(ListObjects);
    const folder = bucketPath(standIn.root)(bucket);
    const prefix = search.prefix ?? "";
    const entries = yield* standIn.files.readDirectory(folder, { recursive: true });

    const files = yield* Effect.filter(entries, (key) =>
      Effect.map(isFile(standIn, `${folder}/${key}`), (file) => file && Str.startsWith(prefix)(key)),
    );

    const contents = yield* Effect.forEach(Arr.sort(files, Order.String), (key) => contentsOf(standIn, folder, key));

    return HttpServerResponse.text(
      `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>${bucket}</Name><IsTruncated>false</IsTruncated>${Arr.join(contents, "")}</ListBucketResult>`,
      { contentType: "application/xml" },
    );
  });

// One route for every read of the data plane, since the router takes one GET pattern below the root: "/<bucket>" lists
// The bucket and "/<bucket>/<key>" reads a file.
const readBucket = (standIn: StandIn): Handler =>
  Effect.flatMap(HttpRouter.schemaPathParams(Schema.Struct({ "*": Schema.String })), (params) => {
    const [bucket, ...key] = Str.split("/")(params["*"]);

    if (Arr.isReadonlyArrayNonEmpty(key)) {
      return getObject(standIn, `${bucketPath(standIn.root)(bucket)}/${Arr.join(key, "/")}`);
    }

    return listObjects(standIn, bucket);
  });

const routesOf = (standIn: StandIn): Routes =>
  HttpRouter.addAll([
    HttpRouter.route("GET", "/api/disks", listDisks(standIn)),
    HttpRouter.route("POST", "/api/disks", createDisk(standIn)),
    HttpRouter.route("GET", "/api/disks/:id", getDisk(standIn)),
    HttpRouter.route("DELETE", "/api/disks/:id", deleteDisk(standIn)),
    HttpRouter.route("POST", "/api/disks/:id/exec", execDisk(standIn)),
    HttpRouter.route("GET", "/api/disks/:id/branches/:name", getBranch(standIn)),
    HttpRouter.route("POST", "/api/disks/:id/branches", createBranch(standIn)),
    HttpRouter.route("GET", "/*", readBucket(standIn)),
    HttpRouter.route("PUT", "/:bucket/*", putObject(standIn)),
    HttpRouter.route("DELETE", "/:bucket/*", deleteObject(standIn)),
  ]);

// Archil's disk routes, keeping every disk under the root folder.
const ArchilDisksStandIn = (
  root: string,
): Layer.Layer<
  never,
  never,
  Layer.Services<Routes> | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> =>
  Layer.unwrap(
    Effect.gen(function* archilDisksStandIn() {
      const registry = yield* Ref.make<Registry>({ branches: HashMap.empty(), disks: HashMap.empty(), next: NEXT_ID });
      const files = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

      return routesOf({ files, paths, registry, root, spawner });
    }),
  );

export { ArchilDisksStandIn, bucketPath };
