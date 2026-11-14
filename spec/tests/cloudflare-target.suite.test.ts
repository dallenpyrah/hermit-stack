import { protocolHttp } from "@alchemy.run/domain";
import { layer as nodeServices } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Config, Context, Deferred, Effect, FileSystem, Layer, Option, Path, Ref, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { TestClock } from "effect/testing";

import { ledgerConformance } from "@repo/conformance/ledger";
import { AccountId } from "@repo/ledger/account-id";
import { LedgerApi } from "@repo/ledger/api";

class StateDirectory extends Context.Service<StateDirectory, { readonly path: string }>()(
  "@repo/spec/tests/cloudflare-target.suite.test/StateDirectory",
) {}

const stateDirectory = Layer.effect(
  StateDirectory,
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    Effect.map(fs.makeTempDirectoryScoped({ prefix: "hermit-stack-cloudflare-" }), (path) =>
      StateDirectory.of({ path }),
    ),
  ),
);

const readyLine = /ready at (?<url>http:\/\/\S+)/u;

const urlIn = (line: string): Option.Option<string> => Option.fromNullishOr(readyLine.exec(line)?.groups?.url);

const devCommand = Effect.gen(function* devCommandCase() {
  const path = yield* Path.Path;
  const directory = yield* StateDirectory;
  const stack = yield* path.fromFileUrl(new globalThis.URL(import.meta.resolve("@repo/api/cloudflare-stack")));
  const alchemy = path.join(import.meta.dirname, "../node_modules/.bin/alchemy");
  const env = yield* Config.all({ HOME: Config.String("HOME"), PATH: Config.String("PATH") });

  return ChildProcess.make(alchemy, ["dev", stack, "--stage", "spec", "--no-input"], {
    cwd: directory.path,
    env: {
      ...env,
      ALCHEMY_TELEMETRY_DISABLED: "1",
      CLOUDFLARE_ACCOUNT_ID: "00000000000000000000000000000000",
      DO_NOT_TRACK: "1",
    },
    forceKillAfter: "10 seconds",
  });
});

const servedAddress = Effect.fn("servedAddress")(function* servedAddressCase(
  child: ChildProcessSpawner.ChildProcessHandle,
) {
  const output = yield* Ref.make<readonly string[]>([]);
  const ready = yield* Deferred.make<string>();

  const recordLine = (line: string): Effect.Effect<void> =>
    Effect.andThen(
      Ref.update(output, Arr.append(line)),
      Option.match(urlIn(line), { onNone: () => Effect.void, onSome: (url) => Deferred.succeed(ready, url) }),
    );

  yield* child.all.pipe(Stream.decodeText(), Stream.splitLines, Stream.runForEach(recordLine), Effect.forkScoped);

  const exited = Effect.flatMap(Effect.zip(child.exitCode, Ref.get(output)), ([code, lines]) =>
    Effect.die(`alchemy dev exited with ${code} before serving:\n${Arr.join(lines, "\n")}`),
  );

  return yield* Effect.raceFirst(Deferred.await(ready), exited);
});

const startWorker = Effect.gen(function* startWorkerCase() {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const command = yield* devCommand;
  const child = yield* spawner.spawn(command);

  return yield* servedAddress(child);
});

const workerProtocol = Layer.unwrap(Effect.map(startWorker, (url) => protocolHttp(`${url}/rpc`)));

const ledgerOnWorker = LedgerApi.layerClient.pipe(
  Layer.provide(workerProtocol),
  Layer.provide([FetchHttpClient.layer, nodeServices]),
);

const keptAccount = AccountId.make("kept-across-restart");

const openBeforeRestart = Effect.gen(function* openBeforeRestartCase() {
  const ledger = yield* LedgerApi.Client;

  yield* ledger.OpenAccount(keptAccount, { owner: "ada" });

  const receipt = yield* ledger.DepositMoney(keptAccount, { amount: 25 });

  yield* ledger.Balance.get(keptAccount, { atLeast: receipt });
});

const firstWorker = Layer.fresh(ledgerOnWorker);

const openedOnFirstWorker = Effect.flatMap(Layer.build(firstWorker), (services) =>
  Effect.provideContext(openBeforeRestart, services),
);

const restarted = Layer.effectDiscard(Effect.scoped(openedOnFirstWorker));

const readsTheKeptAccount = Effect.fn("readsTheKeptAccount")(function* readsTheKeptAccountCase() {
  const ledger = yield* LedgerApi.Client;
  const balance = yield* ledger.Balance.get(keptAccount);

  expect(balance).toStrictEqual({ balance: 25, owner: "ada", status: "open" });
});

describe("the Cloudflare target, in workerd on this machine", () => {
  it.layer(Layer.provideMerge(stateDirectory, nodeServices), { timeout: "4 minutes" })(
    "with its storage in a fresh directory",
    (onStorage) => {
      onStorage.layer(Layer.provideMerge(ledgerOnWorker, restarted), { timeout: "6 minutes" })(
        "called over HTTP after a restart",
        (afterRestart) => {
          afterRestart.effect("reads an account the Worker before the restart opened", () =>
            TestClock.withLive(readsTheKeptAccount()),
          );
          ledgerConformance(afterRestart);
        },
      );
    },
  );
});
