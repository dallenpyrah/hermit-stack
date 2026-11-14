import { layer as nodeServices } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Path, Stream } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { NewCheckout } from "#tests/fixtures/current/new-checkout.flag";
import { OldCheckout, PaymentsKillSwitch } from "#tests/fixtures/expired/old-checkout.flag";

const success = 0;

const runTimeout = 120_000;

interface CheckRun {
  readonly exitCode: number;
  readonly output: string;
}

const runCheck = (
  fixture: string,
): Effect.Effect<CheckRun, PlatformError, ChildProcessSpawner.ChildProcessSpawner | Path.Path> =>
  Effect.gen(function* runCheckIn() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const path = yield* Path.Path;
    const cli = path.resolve(import.meta.dirname, "../../src/check/flags-check.cli.ts");
    const folder = path.resolve(import.meta.dirname, "../fixtures", fixture);
    const handle = yield* spawner.spawn(ChildProcess.make("node", [cli, folder]));

    const [output, exitCode] = yield* Effect.all([Stream.mkString(Stream.decodeText(handle.all)), handle.exitCode], {
      concurrency: 2,
    });

    return { exitCode, output };
  }).pipe(Effect.scoped);

const failsOnPastDates = Effect.fn("failsOnPastDates")(function* failsOnPastDates() {
  const run = yield* runCheck("expired");

  expect(run.exitCode).not.toBe(success);
  expect(run.output).toContain(
    `${OldCheckout.name} (old-checkout.flag.ts, owner checkout) was due for removal on 2001-01-01.`,
  );
  expect(run.output).toContain(
    `${PaymentsKillSwitch.name} (old-checkout.flag.ts, owner payments) was due for review on 2002-02-02.`,
  );
});

const passesFutureDates = Effect.fn("passesFutureDates")(function* passesFutureDates() {
  const run = yield* runCheck("current");

  expect(run.exitCode).toBe(success);
  expect(run.output).toContain("1 .flag.ts files");
  expect(run.output).not.toContain(NewCheckout.name);
});

describe("the flags:check command", () => {
  it.layer(nodeServices)("run on a fixture folder", (withNode) => {
    withNode.effect("exits non-zero and names each flag past its removal or review date", failsOnPastDates, runTimeout);
    withNode.effect("exits zero when every flag is dated in the future", passesFutureDates, runTimeout);
  });
});
