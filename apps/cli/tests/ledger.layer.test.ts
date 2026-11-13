import { InMemory } from "@alchemy.run/domain";
import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { layer as nodeServices } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  ConfigProvider,
  Console,
  Effect,
  Layer,
  Option,
  Runtime,
  Schema,
  Stdio,
  String as Str,
  pipe,
} from "effect";
import type { Exit } from "effect";
import { HttpRouter, HttpServer } from "effect/http";

import { LedgerApi } from "@repo/ledger/api";
import { Ledger } from "@repo/ledger/model";

import { exitCode, exposed, ledger } from "#src/ledger.layer.js";

interface Run {
  readonly code: number;
  readonly stderr: string;
  readonly stdout: string;
}

interface RunOptions {
  readonly env?: Readonly<Record<string, string>>;
  readonly expose?: typeof exposed;
}

// Apps do not depend on services, so the test serves the ledger itself: the model on the in-memory host, with the Api's
// Derived RPC endpoint mounted at /rpc on a port the operating system assigns. Running the CLI against the real server
// Entry is the spec's job.
const rpcRoute = HttpRouter.use((router) => Effect.flatMap(LedgerApi, (api) => router.add("POST", "/rpc", api.fetch)));

const served = HttpRouter.serve(rpcRoute, { disableListenLog: true, disableLogger: true }).pipe(
  Layer.provide(Ledger.layer(Layer.empty)),
  Layer.provide(InMemory),
  Layer.provideMerge(Layer.merge(layerTest, nodeServices)),
);

const serverAddress = HttpServer.addressFormattedWith(Effect.succeed);

// A fresh server that listened and then closed, so nothing answers at its address.
const otherServer = Layer.build(Layer.fresh(layerTest));

const closedAddress = Effect.scoped(
  Effect.flatMap(otherServer, (services) => Effect.provideContext(serverAddress, services)),
);

const decodeJson = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Json));

const exitCodeOf = (exit: Exit.Exit<unknown, unknown>): Effect.Effect<number> =>
  Effect.callback<number>((resume) => {
    Runtime.defaultTeardown(exit, (code) => {
      resume(Effect.succeed(code));
    });
  });

const lineOf = (parts: readonly unknown[]): string => Arr.join(Arr.map(parts, String), " ");

// Runs the program the ledger binary runs, with these arguments, and keeps what it printed and the code runMain would
// Exit with.
const run = Effect.fn("run")(function* runLedger(args: readonly string[], options: RunOptions = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const console: Console.Console = {
    ...globalThis.console,
    error: (...parts: readonly unknown[]) => {
      stderr.push(lineOf(parts));
    },
    log: (...parts: readonly unknown[]) => {
      stdout.push(lineOf(parts));
    },
  };

  const exit = yield* ledger(options.expose).pipe(
    Effect.provideServiceEffect(
      Stdio.Stdio,
      Effect.map(Stdio.Stdio, (stdio) => ({ ...stdio, args: Effect.succeed(args) })),
    ),
    Effect.provideService(Console.Console, console),
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(options.env ?? {})),
    Effect.exit,
  );

  const code = yield* exitCodeOf(exit);

  return { code, stderr: Arr.join(stderr, "\n"), stdout: Arr.join(stdout, "\n") } satisfies Run;
});

const printsReceiptsForAPerson = Effect.fn("printsReceiptsForAPerson")(function* printsReceiptsForAPersonCase() {
  const server = yield* serverAddress;

  const opened = yield* run(["open-account", "--server", server, "--target", "text-1", "--owner", "sam"]);
  yield* run(["deposit-money", "--server", server, "--target", "text-1", "--amount", "80"]);
  const deposited = yield* run(["deposit-money", "--server", server, "--target", "text-1", "--amount", "45"]);

  expect(opened).toStrictEqual({ code: exitCode.succeeded, stderr: "", stdout: "stream: Account/text-1\nversion: 1" });
  expect(deposited).toStrictEqual({
    code: exitCode.succeeded,
    stderr: "",
    stdout: "reply:\n  balance: 125\nstream: Account/text-1\nversion: 3",
  });
});

const printsWireJsonForAScript = Effect.fn("printsWireJsonForAScript")(function* printsWireJsonForAScriptCase() {
  const env = { LEDGER_URL: yield* serverAddress };

  const opened = yield* run(["open-account", "--target", "json-1", "--owner", "sam", "--output", "json"], { env });
  yield* run(["deposit-money", "--target", "json-1", "--amount", "80", "--output", "json"], { env });
  const deposited = yield* run(["deposit-money", "--target", "json-1", "--amount", "45", "--output", "json"], { env });

  const openedJson = yield* decodeJson(opened.stdout);
  const depositedJson = yield* decodeJson(deposited.stdout);

  expect(opened.code).toBe(exitCode.succeeded);
  expect(openedJson).toMatchObject({ stream: "Account/json-1", version: 1 });
  expect(deposited.code).toBe(exitCode.succeeded);
  expect(depositedJson).toStrictEqual({ reply: { balance: 125 }, stream: "Account/json-1", version: 3 });
});

const refusesAnOverdraft = Effect.fn("refusesAnOverdraft")(function* refusesAnOverdraftCase() {
  const server = yield* serverAddress;
  const withdrawal = ["withdraw-money", "--server", server, "--target", "overdraft-1", "--amount", "81"];

  yield* run(["open-account", "--server", server, "--target", "overdraft-1", "--owner", "sam"]).pipe(
    Effect.andThen(run(["deposit-money", "--server", server, "--target", "overdraft-1", "--amount", "80"])),
  );

  const refused = yield* run(withdrawal);
  const refusedJson = yield* run([...withdrawal, "--output", "json"]);
  const rejection = yield* decodeJson(refusedJson.stderr);

  expect(refused).toStrictEqual({
    code: exitCode.rejected,
    stderr: "Rejected: InsufficientFunds\n  balance: 80\n  requested: 81",
    stdout: "",
  });
  expect(refusedJson.code).toBe(exitCode.rejected);
  expect(rejection).toHaveProperty("_tag", "InsufficientFunds");
  expect(rejection).toMatchObject({ balance: 80, requested: 81 });
});

const namesTheServerItCouldNotReach = Effect.fn("namesTheServerItCouldNotReach")(
  function* namesTheServerItCouldNotReachCase() {
    const server = yield* closedAddress;

    const lost = yield* run(["deposit-money", "--server", server, "--target", "lost-1", "--amount", "80"]);

    expect(lost.code).toBe(exitCode.unreachable);
    expect(lost.code).not.toBe(exitCode.rejected);
    expect(lost.stdout).toBe("");
    expect(lost.stderr).toContain(`${server}/rpc`);
    expect(lost.stderr).toContain("Check that it is running and that --server or LEDGER_URL is its base URL.");
  },
);

const afterHeading = 1;

const firstWord = 1;

// The first word of each line under SUBCOMMANDS in --help.
const subcommandsOf = (help: string): readonly string[] =>
  pipe(
    Arr.get(Str.split(help, "SUBCOMMANDS"), afterHeading),
    Option.getOrElse(() => ""),
    Str.split("\n"),
    Arr.flatMap((line) => Arr.take(Str.split(Str.trim(line), /\s+/u), firstWord)),
    Arr.filter(Str.isNonEmpty),
  );

const buildsOnlyExposedCommands = Effect.fn("buildsOnlyExposedCommands")(function* buildsOnlyExposedCommandsCase() {
  const server = yield* serverAddress;
  const withoutClosing = Arr.filter(exposed, (call) => call !== "CloseAccount");

  const fullHelp = yield* run(["--help"]);
  const help = yield* run(["--help"], { expose: withoutClosing });
  const closed = yield* run(["close-account", "--server", server, "--target", "closed-1"], { expose: withoutClosing });

  expect(subcommandsOf(fullHelp.stdout)).toStrictEqual([
    "open-account",
    "deposit-money",
    "withdraw-money",
    "close-account",
    "balance",
  ]);
  expect(subcommandsOf(help.stdout)).toStrictEqual(["open-account", "deposit-money", "withdraw-money", "balance"]);
  expect(closed.code).toBe(exitCode.usage);
});

describe("the ledger command line", () => {
  it.layer(served)("against a ledger served on a port the operating system assigns", (onServer) => {
    onServer.effect("prints each receipt as text for a person", printsReceiptsForAPerson);
    onServer.effect(
      "prints the wire JSON with --output json, reading the server from LEDGER_URL",
      printsWireJsonForAScript,
    );
    onServer.effect("prints an overdraft's balance and request and exits with the rejected code", refusesAnOverdraft);
    onServer.effect(
      "exits with the unreachable code and says what to check when no server answers",
      namesTheServerItCouldNotReach,
    );
    onServer.effect("has no subcommand for a call its expose list leaves out", buildsOnlyExposedCommands);
  });
});
