import { protocolHttp } from "@alchemy.run/domain";
import { toCli } from "@alchemy.run/domain/Cli";
import type { CallRejected, Exposable } from "@alchemy.run/domain/Cli";
import {
  Array as Arr,
  Config,
  Console,
  Effect,
  Layer,
  Option,
  Predicate,
  Runtime,
  Schema,
  String as Str,
} from "effect";
import { Command, Flag, GlobalFlag } from "effect/cli";
import type { CliError } from "effect/cli";
import { FetchHttpClient } from "effect/http";
import { RpcClientError } from "effect/rpc";

import { LedgerApi } from "@repo/ledger/api";

import { readable } from "#src/readable.pure.js";

type LedgerCall = Exposable<typeof LedgerApi>;

const version = "0.0.0";

const exposed: readonly LedgerCall[] = ["OpenAccount", "DepositMoney", "WithdrawMoney", "CloseAccount", "Balance.get"];

const exitCode = { rejected: 1, succeeded: 0, unreachable: 3, usage: 2 } as const;

const serverFromEnvironment = Config.String("LEDGER_URL");

const Server = GlobalFlag.Setting("server")({
  flag: Flag.String("server").pipe(
    Flag.withDescription(
      "The ledger server's base URL, such as http://localhost:3000. Read from LEDGER_URL when omitted.",
    ),
    Flag.withFallbackConfig(serverFromEnvironment),
  ),
});

const Output = GlobalFlag.Setting("output")({
  flag: Flag.Literals("output", ["text", "json"]).pipe(
    Flag.withDescription("text for a person, json for a script: the wire JSON the Api answers with."),
    Flag.withDefault("text"),
  ),
});

const rpcUrl = (server: string): string => `${Str.replace(/\/+$/u, "")(server)}/rpc`;

const protocol = Layer.unwrap(Effect.map(Effect.service(Server), (server) => protocolHttp(rpcUrl(server)))).pipe(
  Layer.provide(FetchHttpClient.layer),
);

const decodeJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Json));

const rendered = (heading: string, args: readonly unknown[]): readonly unknown[] => {
  const [only, ...rest] = args;

  if (!Arr.isArrayEmpty(rest) || !Predicate.isString(only)) {
    return args;
  }

  return Option.match(decodeJson(only), {
    onNone: () => args,
    onSome: (value) => [`${heading}${readable(value)}`],
  });
};

const toPerson = (outer: Console.Console): Console.Console =>
  new Proxy(outer, {
    get: (target, key: keyof Console.Console) => {
      if (key === "log") {
        return (...args: readonly unknown[]): void => {
          target.log(...rendered("", args));
        };
      }

      if (key === "error") {
        return (...args: readonly unknown[]): void => {
          target.error(...rendered("Rejected: ", args));
        };
      }

      return target[key];
    },
  });

const outputConsole = Effect.gen(function* outputConsoleForSetting() {
  const output = yield* Output;
  const outer = yield* Console.Console;

  if (output === "json") {
    return outer;
  }

  return toPerson(outer);
});

class CommandFailedError extends Schema.TaggedError<CommandFailedError, { readonly brand: unique symbol }>()(
  "CommandFailedError",
  { cause: Schema.Defect(), exitCode: Schema.Int },
) {
  public override readonly [Runtime.errorExitCode] = this.exitCode;

  public override readonly [Runtime.errorReported] = false;
}

type Failure = CallRejected | CliError.CliError;

const reachedNoServer = (failure: Failure): boolean =>
  Predicate.isTagged(failure, "UserError") && Schema.is(RpcClientError.RpcClientError)(failure.cause);

const unreachableHint =
  "No ledger server answered. Check that it is running and that --server or LEDGER_URL is its base URL.";

const withExitCode = (failure: Failure): CallRejected | CommandFailedError => {
  if (Predicate.isTagged(failure, "CallRejected")) {
    return failure;
  }

  if (reachedNoServer(failure)) {
    return CommandFailedError.make({ cause: failure, exitCode: exitCode.unreachable });
  }

  return CommandFailedError.make({ cause: failure, exitCode: exitCode.usage });
};

const hintFor = (failure: Failure): Effect.Effect<void> => {
  if (reachedNoServer(failure)) {
    return Console.error(unreachableHint);
  }

  return Effect.void;
};

const ledger = (
  expose: readonly LedgerCall[] = exposed,
): Effect.Effect<void, CallRejected | CommandFailedError, Command.Environment> => {
  const command = toCli(LedgerApi, { expose, name: "ledger" }).pipe(
    Command.provide(protocol),
    Command.provideEffect(Console.Console, outputConsole),
    Command.withGlobalFlags([Server, Output]),
  );

  return Command.run(command, { version }).pipe(Effect.tapError(hintFor), Effect.mapError(withExitCode));
};

export { exitCode, exposed, ledger };
