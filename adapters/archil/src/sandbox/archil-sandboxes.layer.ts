import { deleteSandbox } from "@alchemy.run/archil";
import { createSandbox, getSandbox } from "@distilled.cloud/archil";
import type { ApiResponseSandbox } from "@distilled.cloud/archil";
import { fromApiKey } from "@distilled.cloud/archil/Credentials";
import type { Credentials } from "@distilled.cloud/archil/Credentials";
import { run as runProcess } from "@distilled.cloud/archil/Process";
import type { Process as ArchilProcess, ProcessExit } from "@distilled.cloud/archil/Process";
import { SandboxId, SandboxProviderError, Sandboxes } from "@repo/storage";
import type { Output, Process } from "@repo/storage";
import { Deferred, Effect, Layer, Option, Queue, Schedule, Stream } from "effect";
import type { Cause } from "effect";
import { FetchHttpClient } from "effect/http";
import type { HttpClient } from "effect/http";

import { addressOf } from "#src/archil-ids.pure.js";
import type { ArchilSettings } from "#src/archil-settings.schema.js";

type Client = Credentials | HttpClient.HttpClient;

type Service = Sandboxes["Service"];

type Run = <Success, Failure, Rest>(
  effect: Effect.Effect<Success, Failure, Client | Rest>,
) => Effect.Effect<Success, Failure, Exclude<Rest, Client>>;

interface Pipes {
  readonly output: Queue.Queue<Output, Cause.Done | SandboxProviderError>;
  readonly exit: Deferred.Deferred<number, SandboxProviderError>;
}

// Where the disk is mounted in the sandbox, and so the folder every command starts in: Archil's default mount path,
// The one its serverless exec uses too.
const MOUNT_PATH = "/mnt/archil";

// Archil reports no exit code for a process it killed, such as one that ran out of time.
const KILLED = -1;

const READY_CHECKS = 60;

const providerError =
  (operation: string) =>
  (failure: Error): SandboxProviderError =>
    SandboxProviderError.make({ message: `${failure.name}: ${failure.message}`, operation });

const isRunning = (response: ApiResponseSandbox): boolean => response.data.status === "running";

// A sandbox created with `wait` is usually running already; one still booting is checked once a second.
const untilRunning =
  (run: Run) =>
  (created: ApiResponseSandbox): Effect.Effect<void, SandboxProviderError> => {
    if (isRunning(created)) {
      return Effect.void;
    }

    const polled = run(getSandbox({ sid: created.data.sandbox_id })).pipe(
      Effect.repeat({ schedule: Schedule.spaced("1 second"), times: READY_CHECKS, until: isRunning }),
    );

    return polled.pipe(Effect.asVoid, Effect.mapError(providerError("start")));
  };

const start =
  (run: Run): Service["start"] =>
  (disk) => {
    const address = addressOf(disk);

    if (Option.isSome(address.branch)) {
      const message = "An Archil sandbox mounts a disk's root only, not a branch.";

      return Effect.fail(SandboxProviderError.make({ message, operation: "start" }));
    }

    const created = run(createSandbox({ mounts: [{ disk_id: address.disk, path: MOUNT_PATH }], wait: true }));

    return created.pipe(
      Effect.mapError(providerError("start")),
      Effect.tap(untilRunning(run)),
      Effect.map((response) => SandboxId.make(response.data.sandbox_id)),
    );
  };

const exitCodeOf = (ended: ProcessExit): number => Option.getOrElse(Option.fromNullishOr(ended.exitCode), () => KILLED);

const settle = (pipes: Pipes, ended: ProcessExit): Effect.Effect<void> =>
  Effect.andThen(Queue.end(pipes.output), Deferred.succeed(pipes.exit, exitCodeOf(ended)));

const fail = (pipes: Pipes, failure: SandboxProviderError): Effect.Effect<void> =>
  Effect.andThen(Queue.fail(pipes.output, failure), Deferred.fail(pipes.exit, failure));

// Copies Archil's output into the port's own queue and exit code, so the output can be read after the exit code and
// Nothing is lost: Archil's own exit waits by draining that same output.
const relay = (attached: ArchilProcess, pipes: Pipes): Effect.Effect<void> => {
  const copied = Stream.runForEach(attached.output, (chunk) =>
    Queue.offer(pipes.output, { bytes: chunk.data, channel: chunk.stream }),
  );

  return copied.pipe(
    Effect.andThen(attached.exit),
    Effect.mapError(providerError("run")),
    Effect.matchEffect({ onFailure: (failure) => fail(pipes, failure), onSuccess: (ended) => settle(pipes, ended) }),
  );
};

const runCommand =
  (run: Run): Service["run"] =>
  (sandbox, command) =>
    Effect.gen(function* runInSandbox() {
      const attached = yield* Effect.mapError(
        run(runProcess(sandbox, command, { cwd: MOUNT_PATH })),
        providerError("run"),
      );

      const pipes: Pipes = {
        exit: yield* Deferred.make<number, SandboxProviderError>(),
        output: yield* Queue.unbounded<Output, Cause.Done | SandboxProviderError>(),
      };

      yield* Effect.forkScoped(relay(attached, pipes));

      return {
        exit: Deferred.await(pipes.exit),
        output: Stream.fromQueue(pipes.output),
        write: (input: Uint8Array) => Effect.mapError(attached.write(input), providerError("write")),
      } satisfies Process;
    });

const stop =
  (run: Run): Service["stop"] =>
  (sandbox) => {
    const deleted = run(deleteSandbox(sandbox));

    return Effect.mapError(deleted, providerError("stop"));
  };

const clientOf = (settings: ArchilSettings): Layer.Layer<Client> =>
  Layer.provideMerge(FetchHttpClient.layer, fromApiKey(settings));

// Sandboxes on Archil: a Firecracker microVM per sandbox with the disk mounted at /mnt/archil, and each command run
// Over Archil's process socket, so its output streams while it runs.
const ArchilSandboxes = (settings: ArchilSettings): Layer.Layer<Sandboxes> => {
  const service = Effect.map(Layer.build(clientOf(settings)), (client) => {
    const run: Run = (effect) => Effect.provideContext(effect, client);

    return Sandboxes.of({ run: runCommand(run), start: start(run), stop: stop(run) });
  });

  return Layer.effect(Sandboxes, service);
};

export { ArchilSandboxes };
