import type { Sandbox as SandboxResponse, SandboxConnection } from "@distilled.cloud/archil";
import { Effect, HashMap, Layer, Option, Predicate, Queue, Ref, Schema, Stream, String as Str } from "effect";
import type { Cause, PlatformError, Scope } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { HttpServerError } from "effect/http";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import type { Socket } from "effect/socket";

import { bucketPath } from "#tests/disk/archil-disks.fake";

// The sandbox half of the local stand-in for Archil's HTTP API: the control plane's sandbox routes and the process
// Socket a connection URL opens. A sandbox is the folder of the disk it mounts, and each process is a real `sh` run in
// That folder, speaking Archil's process protocol: a start message in, then "started", output frames, and "exit" out.

interface Sandbox {
  readonly id: string;
  readonly disk: string;
  readonly mount: string;
  readonly status: SandboxResponse["status"];
}

interface StandIn {
  readonly root: string;
  readonly sandboxes: Ref.Ref<HashMap.HashMap<string, Sandbox>>;
  readonly next: Ref.Ref<number>;
  readonly spawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
}

type Failure = HttpServerError.HttpServerError | PlatformError.PlatformError | Schema.SchemaError | Socket.SocketError;

type Handler = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  Failure,
  HttpServerRequest.HttpServerRequest | HttpRouter.RouteContext | Scope.Scope
>;

// What the routes need from the server that serves them: a router, and a way to answer a route that failed.
type Routes = Layer.Layer<never, never, HttpRouter.HttpRouter | HttpRouter.Request<"Error", Failure>>;

interface Chunk {
  readonly channel: number;
  readonly bytes: Uint8Array;
}

type Stdin = Queue.Queue<Uint8Array, Cause.Done>;

interface Attached {
  readonly start: typeof Start.Type;
  readonly stdin: Stdin;
  readonly writer: Socket.Writer;
}

const NOT_FOUND = 404;

const CONFLICT = 409;

const NEXT_ID = 1;

const START_OFFSET = 0;

// An output frame is one byte naming the stream, an 8-byte big-endian offset into the combined output, then the bytes.
const STDOUT = 1;

const STDERR = 2;

const OFFSET_AT = 1;

const HEADER_BYTES = 9;

const CREATED_AT = "2026-01-01T00:00:00.000Z";

const DEFAULT_MOUNT = "/mnt/archil";

const MACHINE = {
  base_image: "ubuntu-24.04",
  idle_ttl_seconds: 300,
  max_concurrent_execs: 8,
  max_ttl_seconds: 3600,
  mem_size_mib: 2048,
  vcpu_count: 2,
};

const SandboxParams = Schema.Struct({ sid: Schema.String });

const Mount = Schema.Struct({ disk_id: Schema.String, path: Schema.optionalKey(Schema.String) });

const CreateSandbox = Schema.Struct({ mounts: Schema.Array(Mount) });

const Start = Schema.Struct({
  command: Schema.String,
  cwd: Schema.optionalKey(Schema.String),
  type: Schema.Literal("start"),
});

const StartMessage = Schema.fromJsonString(Start);

const CloseStdin = Schema.fromJsonString(Schema.Struct({ type: Schema.Literal("close_stdin") }));

const Started = Schema.fromJsonString(Schema.Struct({ process_id: Schema.String, type: Schema.Literal("started") }));

const Exited = Schema.fromJsonString(
  Schema.Struct({
    cursor: Schema.Finite,
    exit_code: Schema.Finite,
    status: Schema.Literal("exited"),
    type: Schema.Literal("exit"),
  }),
);

// Archil wraps every control-plane answer in this envelope.
const ok = (answer: SandboxResponse | SandboxConnection): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.jsonUnsafe({ data: answer, success: true });

const refusal = (error: string, status: number): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.jsonUnsafe({ error, success: false }, { status });

const sandboxJson = (sandbox: Sandbox): SandboxResponse => ({
  ...MACHINE,
  created_at: CREATED_AT,
  last_active_at: CREATED_AT,
  mounts: [{ disk_id: sandbox.disk, path: sandbox.mount }],
  name: sandbox.id,
  sandbox_id: sandbox.id,
  status: sandbox.status,
});

const sandboxOf = (standIn: StandIn, id: string): Effect.Effect<Option.Option<Sandbox>> =>
  Effect.map(Ref.get(standIn.sandboxes), HashMap.get(id));

const save = (standIn: StandIn, sandbox: Sandbox): Effect.Effect<void> =>
  Ref.update(standIn.sandboxes, HashMap.set(sandbox.id, sandbox));

// A sandbox boots at once here, so it answers "running" even before Archil's `wait` would.
const createSandbox = (standIn: StandIn): Handler =>
  Effect.gen(function* createSandboxRoute() {
    const body = yield* HttpServerRequest.schemaBodyJson(CreateSandbox);
    const id = yield* Ref.getAndUpdate(standIn.next, (next) => next + NEXT_ID);
    const mounted = Option.fromNullishOr(body.mounts[START_OFFSET]);

    if (Option.isNone(mounted)) {
      return refusal("The stand-in runs a sandbox on one mounted disk", CONFLICT);
    }

    const sandbox: Sandbox = {
      disk: mounted.value.disk_id,
      id: `sbx-${id}`,
      mount: mounted.value.path ?? DEFAULT_MOUNT,
      status: "running",
    };

    yield* save(standIn, sandbox);

    return ok(sandboxJson(sandbox));
  });

const getSandbox = (standIn: StandIn): Handler =>
  Effect.gen(function* getSandboxRoute() {
    const { sid } = yield* HttpRouter.schemaPathParams(SandboxParams);
    const sandbox = yield* sandboxOf(standIn, sid);

    return Option.match(sandbox, {
      onNone: () => refusal("Sandbox not found", NOT_FOUND),
      onSome: (found) => ok(sandboxJson(found)),
    });
  });

const stopSandbox = (standIn: StandIn): Handler =>
  Effect.gen(function* stopSandboxRoute() {
    const { sid } = yield* HttpRouter.schemaPathParams(SandboxParams);
    const sandbox = yield* sandboxOf(standIn, sid);

    if (Option.isNone(sandbox)) {
      return refusal("Sandbox not found", NOT_FOUND);
    }

    const stopped: Sandbox = { ...sandbox.value, status: "stopped" };

    yield* save(standIn, stopped);

    return ok(sandboxJson(stopped));
  });

// Archil deletes only a stopped sandbox, and answers the delete with a bare object.
const deleteSandbox = (standIn: StandIn): Handler =>
  Effect.gen(function* deleteSandboxRoute() {
    const { sid } = yield* HttpRouter.schemaPathParams(SandboxParams);
    const sandbox = yield* sandboxOf(standIn, sid);

    if (Option.isNone(sandbox)) {
      return refusal("Sandbox not found", NOT_FOUND);
    }

    if (sandbox.value.status !== "stopped") {
      return refusal("Sandbox is not stopped", CONFLICT);
    }

    yield* Ref.update(standIn.sandboxes, HashMap.remove(sid));

    return HttpServerResponse.jsonUnsafe({});
  });

const connectSandbox = (standIn: StandIn): Handler =>
  Effect.gen(function* connectSandboxRoute() {
    const { sid } = yield* HttpRouter.schemaPathParams(SandboxParams);
    const request = yield* HttpServerRequest.HttpServerRequest;
    const sandbox = yield* sandboxOf(standIn, sid);
    const host = request.headers.host ?? "";

    return Option.match(sandbox, {
      onNone: () => refusal("Sandbox not found", NOT_FOUND),
      onSome: () => ok({ expires_at: CREATED_AT, url: `ws://${host}/ws/${sid}` }),
    });
  });

const frameOf = (chunk: Chunk, offset: number): Uint8Array => {
  const frame = new Uint8Array(HEADER_BYTES + chunk.bytes.byteLength);

  frame.set([chunk.channel]);
  new DataView(frame.buffer).setBigUint64(OFFSET_AT, BigInt(offset));
  frame.set(chunk.bytes, HEADER_BYTES);

  return frame;
};

const tagged =
  (channel: number) =>
  (bytes: Uint8Array): Chunk => ({ bytes, channel });

// Stdin arrives as binary frames, and a "close_stdin" text frame ends it.
const feed =
  (stdin: Stdin) =>
  (frame: Uint8Array | string): Effect.Effect<unknown> => {
    if (!Predicate.isString(frame)) {
      return Queue.offer(stdin, frame);
    }

    return Option.match(Schema.decodeOption(CloseStdin)(frame), {
      onNone: () => Effect.void,
      onSome: () => Queue.end(stdin),
    });
  };

const pumpStdin = (reader: Socket.Reader, stdin: Stdin): Effect.Effect<void> =>
  reader.pull.pipe(
    Effect.flatMap((frames) => Effect.forEach(frames, feed(stdin))),
    Effect.forever,
    Effect.ensuring(Queue.end(stdin)),
    Effect.ignore,
  );

// Sends every output chunk as it comes, and answers the offset reached, which the exit message reports as its cursor.
const relay = (
  output: Stream.Stream<Chunk, PlatformError.PlatformError>,
  writer: Socket.Writer,
): Effect.Effect<number, PlatformError.PlatformError | Socket.SocketError> =>
  Stream.runFoldEffect(
    output,
    () => START_OFFSET,
    (offset, chunk) => Effect.as(writer.write(frameOf(chunk, offset)), offset + chunk.bytes.byteLength),
  );

const inFolder = (sandbox: Sandbox, folder: string, text: string): string =>
  Str.replaceAll(sandbox.mount, folder)(text);

// The first frame starts the process, and every frame after it feeds the process's stdin.
const attach = (socket: Socket.Socket): Effect.Effect<Attached, Failure, Scope.Scope> =>
  Effect.gen(function* attachToSocket() {
    const reader = yield* socket.reader;
    const writer = yield* socket.writer;
    const [first, ...rest] = yield* reader.pull;
    const start = yield* Schema.decodeUnknownEffect(StartMessage)(first);
    const stdin = yield* Queue.unbounded<Uint8Array, Cause.Done>();

    yield* Effect.forEach(rest, feed(stdin));
    yield* Effect.forkScoped(pumpStdin(reader, stdin));

    return { start, stdin, writer };
  });

// Runs the command in the disk's folder, which stands where the sandbox mounts the disk.
const spawnIn = (
  standIn: StandIn,
  sandbox: Sandbox,
  attached: Attached,
): Effect.Effect<ChildProcessSpawner.ChildProcessHandle, PlatformError.PlatformError, Scope.Scope> => {
  const folder = bucketPath(standIn.root)(sandbox.disk);

  const command = ChildProcess.make("sh", ["-c", inFolder(sandbox, folder, attached.start.command)], {
    cwd: inFolder(sandbox, folder, attached.start.cwd ?? sandbox.mount),
    stdin: Stream.fromQueue(attached.stdin),
  });

  return standIn.spawner.spawn(command);
};

const outputOf = (
  handle: ChildProcessSpawner.ChildProcessHandle,
): Stream.Stream<Chunk, PlatformError.PlatformError> => {
  const stdout = Stream.map(handle.stdout, tagged(STDOUT));
  const stderr = Stream.map(handle.stderr, tagged(STDERR));

  return Stream.merge(stdout, stderr);
};

// Archil's process protocol: "started" once the process runs, its output as it comes, then "exit" after all of it.
const runProcess = (standIn: StandIn, sandbox: Sandbox, socket: Socket.Socket): Handler =>
  Effect.gen(function* runProcessOnSocket() {
    const attached = yield* attach(socket);
    const handle = yield* spawnIn(standIn, sandbox, attached);
    const started = yield* Schema.encodeEffect(Started)({ process_id: `${handle.pid}`, type: "started" });

    yield* attached.writer.write(started);

    const cursor = yield* relay(outputOf(handle), attached.writer);
    const exitCode = yield* handle.exitCode;
    const exited = yield* Schema.encodeEffect(Exited)({ cursor, exit_code: exitCode, status: "exited", type: "exit" });

    yield* attached.writer.write(exited);

    return HttpServerResponse.empty();
  });

const processSocket = (standIn: StandIn): Handler =>
  Effect.gen(function* processSocketRoute() {
    const { sid } = yield* HttpRouter.schemaPathParams(SandboxParams);
    const sandbox = yield* sandboxOf(standIn, sid);

    if (Option.isNone(sandbox) || sandbox.value.status !== "running") {
      return refusal("Sandbox is not running", NOT_FOUND);
    }

    const request = yield* HttpServerRequest.HttpServerRequest;
    const socket = yield* request.upgrade;

    return yield* runProcess(standIn, sandbox.value, socket);
  });

const routesOf = (standIn: StandIn): Routes =>
  HttpRouter.addAll([
    HttpRouter.route("POST", "/api/sandboxes", createSandbox(standIn)),
    HttpRouter.route("GET", "/api/sandboxes/:sid", getSandbox(standIn)),
    HttpRouter.route("POST", "/api/sandboxes/:sid/stop", stopSandbox(standIn)),
    HttpRouter.route("DELETE", "/api/sandboxes/:sid", deleteSandbox(standIn)),
    HttpRouter.route("POST", "/api/sandboxes/:sid/connections", connectSandbox(standIn)),
    HttpRouter.route("GET", "/ws/:sid", processSocket(standIn)),
  ]);

// Archil's sandbox routes, running each process in the folder of the disk it mounts under the root folder.
const ArchilSandboxesStandIn = (
  root: string,
): Layer.Layer<never, never, Layer.Services<Routes> | ChildProcessSpawner.ChildProcessSpawner> =>
  Layer.unwrap(
    Effect.gen(function* archilSandboxesStandIn() {
      const sandboxes = yield* Ref.make(HashMap.empty<string, Sandbox>());
      const next = yield* Ref.make(NEXT_ID);
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

      return routesOf({ next, root, sandboxes, spawner });
    }),
  );

export { ArchilSandboxesStandIn };
