import { expect } from "@effect/vitest";
import { Array as Arr, Effect, Fiber, Layer, Random, Ref, Schedule, Stream, String as Str, pipe } from "effect";
import type { Cause, Scope } from "effect";

import type { DiskProviderError } from "#src/disk/disk-provider.errors.js";
import { Disks } from "#src/disk/disks.service.js";
import type { FileNotFoundError } from "#src/disk/file-not-found.errors.js";
import type { SandboxProviderError } from "#src/sandbox/sandbox-provider.errors.js";
import type { Output, SandboxId } from "#src/sandbox/sandbox.schema.js";
import { Sandboxes } from "#src/sandbox/sandboxes.service.js";
import type { Process } from "#src/sandbox/sandboxes.service.js";

const encoder = new globalThis.TextEncoder();

const RUN_TAG_FLOOR = 0;

const RUN_TAG_LIMIT = 1_000_000_000;

const SUCCEEDED_STATUS = 0;

const FAILED_STATUS = 3;

const bytes = (text: string): Uint8Array => encoder.encode(text);

const textOf = (outputs: readonly Output[], channel: Output["channel"]): string => {
  const decoder = new globalThis.TextDecoder();

  return pipe(
    outputs,
    Arr.filter((output) => output.channel === channel),
    Arr.map((output) => decoder.decode(output.bytes, { stream: true })),
    Arr.join(""),
  );
};

// A disk and a sandbox on it for one case, both removed when the case ends.
const sandboxOnFreshDisk = Effect.fn("sandboxOnFreshDisk")(function* sandboxOnFreshDisk(label: string) {
  const disks = yield* Disks;
  const sandboxes = yield* Sandboxes;
  const tag = yield* Random.nextIntBetween(RUN_TAG_FLOOR, RUN_TAG_LIMIT);

  const disk = yield* Effect.acquireRelease(disks.create(`contract-${label}-${tag}`), (opened) =>
    Effect.ignore(disks.delete(opened)),
  );

  return {
    disk,
    start: Effect.acquireRelease(sandboxes.start(disk), (sandbox) => Effect.ignore(sandboxes.stop(sandbox))),
  };
});

const runToEnd = Effect.fn("runToEnd")(function* runToEnd(sandbox: SandboxId, command: string) {
  const sandboxes = yield* Sandboxes;
  const process = yield* sandboxes.run(sandbox, command);
  const outputs = yield* Stream.runCollect(process.output);

  return { exit: yield* process.exit, outputs };
});

const readsDisk = Effect.fn("readsDisk")(function* readsDisk() {
  const disks = yield* Disks;
  const { disk, start } = yield* sandboxOnFreshDisk("read");

  yield* disks.write(disk, "notes.txt", bytes("hello from the disk\n"));
  const sandbox = yield* start;
  const result = yield* runToEnd(sandbox, "cat notes.txt");

  expect(textOf(result.outputs, "stdout")).toBe("hello from the disk\n");
  expect(result.exit).toBe(SUCCEEDED_STATUS);
});

const keepsWrites = Effect.fn("keepsWrites")(function* keepsWrites() {
  const disks = yield* Disks;
  const sandboxes = yield* Sandboxes;
  const { disk, start } = yield* sandboxOnFreshDisk("keep");
  const sandbox = yield* start;
  const result = yield* runToEnd(sandbox, "echo made in a sandbox > made.txt");

  yield* sandboxes.stop(sandbox);
  yield* sandboxes.stop(sandbox);

  expect(result.exit).toBe(SUCCEEDED_STATUS);
  const made = yield* disks.read(disk, "made.txt");

  expect(new globalThis.TextDecoder().decode(made)).toBe("made in a sandbox\n");
});

const reportsFailure = Effect.fn("reportsFailure")(function* reportsFailure() {
  const { start } = yield* sandboxOnFreshDisk("fail");
  const sandbox = yield* start;
  const result = yield* runToEnd(sandbox, "echo something broke >&2; exit 3");

  expect(result.exit).toBe(FAILED_STATUS);
  expect(textOf(result.outputs, "stderr")).toBe("something broke\n");
  expect(textOf(result.outputs, "stdout")).toBe("");
});

// Collects a command's output as it arrives, so a case can look at it before the command ends.
const collect = Effect.fn("collect")(function* collect(process: Process) {
  const seen = yield* Ref.make<readonly Output[]>([]);

  const fiber = yield* Effect.forkScoped(
    Stream.runForEach(process.output, (output) => Ref.update(seen, (outputs) => [...outputs, output])),
  );

  return { fiber, seen };
});

// Waits, on the real clock, until the collected output contains the text, and answers the output seen by then.
const waitForText = (seen: Ref.Ref<readonly Output[]>, text: string): Effect.Effect<string, Cause.TimeoutError> =>
  Ref.get(seen).pipe(
    Effect.map((outputs) => textOf(outputs, "stdout")),
    Effect.repeat({ schedule: Schedule.spaced("20 millis"), until: Str.includes(text) }),
    Effect.timeout("20 seconds"),
  );

const runOnFreshDisk = Effect.fn("runOnFreshDisk")(function* runOnFreshDisk(label: string, command: string) {
  const sandboxes = yield* Sandboxes;
  const { start } = yield* sandboxOnFreshDisk(label);
  const sandbox = yield* start;

  return yield* sandboxes.run(sandbox, command);
});

const streamsBeforeEnd = Effect.fn("streamsBeforeEnd")(function* streamsBeforeEnd() {
  // The command cannot end until the case writes a line, so output seen before that arrived while it ran.
  const process = yield* runOnFreshDisk("stream", "echo ready; read line; echo done");
  const { fiber, seen } = yield* collect(process);
  const early = yield* waitForText(seen, "ready");

  yield* process.write(bytes("go\n"));
  yield* Fiber.join(fiber);

  const all = yield* Ref.get(seen);
  const exit = yield* process.exit;

  expect(early).toBe("ready\n");
  expect(textOf(all, "stdout")).toBe("ready\ndone\n");
  expect(exit).toBe(SUCCEEDED_STATUS);
});

const exitFirst = Effect.fn("exitFirst")(function* exitFirst() {
  const process = yield* runOnFreshDisk("exit-first", "echo one; echo two");
  const exit = yield* process.exit;
  const outputs = yield* Stream.runCollect(process.output);

  expect(exit).toBe(SUCCEEDED_STATUS);
  expect(textOf(outputs, "stdout")).toBe("one\ntwo\n");
});

type Case = () => Effect.Effect<
  void,
  Cause.TimeoutError | DiskProviderError | FileNotFoundError | SandboxProviderError,
  Disks | Sandboxes | Scope.Scope
>;

const cases: readonly (readonly [string, Case])[] = [
  ["runs a command in the disk's root folder, where it sees the disk's files", readsDisk],
  ["keeps what a command wrote on the disk after the sandbox stops, and stopping twice succeeds", keepsWrites],
  ["answers a command that exits non-zero with its exit code and what it printed on stderr", reportsFailure],
  ["streams output while the command is still running", streamsBeforeEnd],
  ["keeps all the output when the exit code is awaited first", exitFirst],
];

type ProvidedCase<Failure> = () => Effect.Effect<
  void,
  Cause.TimeoutError | DiskProviderError | FileNotFoundError | SandboxProviderError | Failure
>;

// The behaviour every Sandboxes adapter must show, given the Disks of the same vendor, as named cases with the adapter
// Provided, each on a fresh build of its Layer. Run them with it.live: one case waits on the real clock.
const sandboxesContract = <Failure>(
  storage: Layer.Layer<Disks | Sandboxes, Failure>,
): readonly (readonly [string, ProvidedCase<Failure>])[] =>
  Arr.map(
    cases,
    ([title, run]) =>
      [
        title,
        () => Effect.scoped(Effect.flatMap(Layer.build(storage), (context) => Effect.provideContext(run(), context))),
      ] as const,
  );

export { sandboxesContract };
