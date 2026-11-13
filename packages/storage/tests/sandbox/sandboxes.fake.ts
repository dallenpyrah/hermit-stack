import {
  Array as Arr,
  Deferred,
  Effect,
  Function as Fn,
  HashMap,
  Layer,
  Match,
  Number as Num,
  Option,
  Queue,
  Ref,
  Stream,
  String as Str,
  pipe,
} from "effect";
import type { Cause } from "effect";

import type { DiskId } from "#src/disk/disk.schema.js";
import { Disks } from "#src/disk/disks.service.js";
import { SandboxProviderError } from "#src/sandbox/sandbox-provider.errors.js";
import { SandboxId } from "#src/sandbox/sandbox.schema.js";
import type { Output } from "#src/sandbox/sandbox.schema.js";
import { Sandboxes } from "#src/sandbox/sandboxes.service.js";

// What a command can reach: the disk it runs against, its output and its input.
interface Terminal {
  readonly readFile: (path: string) => Effect.Effect<Option.Option<Uint8Array>>;
  readonly writeFile: (path: string, content: Uint8Array) => Effect.Effect<void>;
  readonly print: (channel: Output["channel"], bytes: Uint8Array) => Effect.Effect<void>;
  readonly readLine: Effect.Effect<Option.Option<string>>;
}

interface Statement {
  readonly words: readonly string[];
  readonly target: Option.Option<string>;
}

interface Outcome {
  readonly status: number;
  readonly stop: boolean;
}

interface Input {
  readonly chunks: Queue.Queue<string>;
  readonly pending: Ref.Ref<string>;
}

interface State {
  readonly next: number;
  readonly sandboxes: HashMap.HashMap<SandboxId, DiskId>;
}

const encoder = new globalThis.TextEncoder();

const decoder = new globalThis.TextDecoder();

const SUCCESS = 0;

const FAILURE = 1;

const NOT_FOUND = 127;

const NEXT = 1;

const START = 0;

const STDERR = "/dev/stderr";

const tokenPattern = /'(?<single>[^']*)'|"(?<double>[^"]*)"|(?<operator>>&2|>|;|\n)|(?<word>[^\s'";>]+)/gu;

const tokenOf = (match: RegExpMatchArray): string =>
  match.groups?.single ?? match.groups?.double ?? match.groups?.operator ?? match.groups?.word ?? "";

const tokens = (script: string): readonly string[] =>
  Arr.map(Arr.fromIterable(Str.matchAll(tokenPattern)(script)), tokenOf);

const isRedirect = (word: string): boolean => word === ">" || word === ">&2";

const targetAt =
  (words: readonly string[]) =>
  (index: number): Option.Option<string> =>
    Option.flatMap(Arr.get(words, index), (word) =>
      Match.value(word).pipe(
        Match.when(">&2", () => Option.some(STDERR)),
        Match.orElse(() => Arr.get(words, index + NEXT)),
      ),
    );

const statementOf = (words: readonly string[]): Statement =>
  Option.match(Arr.findFirstIndex(words, isRedirect), {
    onNone: () => ({ target: Option.none(), words }),
    onSome: (index) => ({ target: targetAt(words)(index), words: Arr.take(words, index) }),
  });

// Splits a script into statements at ";" and line breaks, the only separators the fake understands.
const parse = (script: string): readonly Statement[] => {
  const statements: Statement[] = [];
  let current: string[] = [];

  for (const token of tokens(script)) {
    if (token === ";" || token === "\n") {
      statements.push(statementOf(current));
      current = [];
    } else {
      current.push(token);
    }
  }

  statements.push(statementOf(current));

  return Arr.filter(statements, (statement) => Arr.isReadonlyArrayNonEmpty(statement.words));
};

const done = (status: number): Outcome => ({ status, stop: false });

// Sends bytes where the statement points them: its output, its error output, or a file on the disk.
const emit =
  (terminal: Terminal, statement: Statement) =>
  (bytes: Uint8Array): Effect.Effect<void> =>
    Option.match(statement.target, {
      onNone: () => terminal.print("stdout", bytes),
      onSome: (target) =>
        Match.value(target).pipe(
          Match.when(STDERR, () => terminal.print("stderr", bytes)),
          Match.orElse(() => terminal.writeFile(target, bytes)),
        ),
    });

const complain =
  (terminal: Terminal, status: number) =>
  (message: string): Effect.Effect<Outcome> =>
    Effect.as(terminal.print("stderr", encoder.encode(`${message}\n`)), done(status));

const cat = (terminal: Terminal, statement: Statement, path: string): Effect.Effect<Outcome> =>
  Effect.flatMap(terminal.readFile(path), (content) =>
    Option.match(content, {
      onNone: () => complain(terminal, FAILURE)(`cat: ${path}: No such file or directory`),
      onSome: (bytes) => Effect.as(emit(terminal, statement)(bytes), done(SUCCESS)),
    }),
  );

const read = (terminal: Terminal): Effect.Effect<Outcome> =>
  Effect.map(terminal.readLine, (line) => done(Option.match(line, { onNone: () => FAILURE, onSome: () => SUCCESS })));

const exit = (args: readonly string[]): Effect.Effect<Outcome> => {
  const status = pipe(Arr.head(args), Option.flatMap(Num.parse), Option.getOrElse(Fn.constant(SUCCESS)));

  return Effect.succeed({ status, stop: true });
};

const echo = (terminal: Terminal, statement: Statement, args: readonly string[]): Effect.Effect<Outcome> => {
  const line = encoder.encode(`${Arr.join(args, " ")}\n`);

  return Effect.as(emit(terminal, statement)(line), done(SUCCESS));
};

const execute = (terminal: Terminal, statement: Statement): Effect.Effect<Outcome> => {
  const [name = "", ...args] = statement.words;

  return Match.value(name).pipe(
    Match.when("echo", () => echo(terminal, statement, args)),
    Match.when("cat", () => cat(terminal, statement, Arr.join(args, " "))),
    Match.when("read", () => read(terminal)),
    Match.when("exit", () => exit(args)),
    Match.orElse(() => complain(terminal, NOT_FOUND)(`sh: ${name}: not found`)),
  );
};

const step =
  (terminal: Terminal) =>
  (outcome: Outcome, statement: Statement): Effect.Effect<Outcome> => {
    if (outcome.stop) {
      return Effect.succeed(outcome);
    }

    return execute(terminal, statement);
  };

// Runs a script in a tiny subset of sh: echo, cat, read and exit, joined by ";" or line breaks, with "> file" and
// ">&2" redirections. The status is the last statement's, unless exit ran first.
const runScript =
  (terminal: Terminal) =>
  (script: string): Effect.Effect<number> => {
    const outcome = Effect.reduce(parse(script), Fn.constant(done(SUCCESS)), step(terminal));

    return Effect.map(outcome, (last) => last.status);
  };

// Reads a line from what was written to the command's input so far, waiting for more when no full line is there.
const takeLine = (input: Input): Effect.Effect<string> =>
  Effect.flatMap(Ref.get(input.pending), (buffered) =>
    Option.match(Str.indexOf("\n")(buffered), {
      onNone: () =>
        Effect.flatMap(Queue.take(input.chunks), (chunk) =>
          Effect.andThen(Ref.set(input.pending, `${buffered}${chunk}`), takeLine(input)),
        ),
      onSome: (end) => {
        const rest = Str.slice(end + NEXT)(buffered);

        return Effect.as(Ref.set(input.pending, rest), Str.slice(START, end)(buffered));
      },
    }),
  );

const terminalOf =
  (disks: Disks["Service"], disk: DiskId) =>
  (input: Input, output: Queue.Queue<Output, Cause.Done>): Terminal => ({
    print: (channel, bytes) => Effect.asVoid(Queue.offer(output, { bytes, channel })),
    readFile: (path) => Effect.orDie(Effect.option(disks.read(disk, path))),
    readLine: Effect.asSome(takeLine(input)),
    writeFile: (path, content) => Effect.orDie(disks.write(disk, path, content)),
  });

const diskOf =
  (state: Ref.Ref<State>) =>
  (sandbox: SandboxId): Effect.Effect<DiskId, SandboxProviderError> =>
    Effect.flatMap(Ref.get(state), (current) =>
      Effect.mapError(Effect.fromOption(HashMap.get(current.sandboxes, sandbox)), () =>
        SandboxProviderError.make({ message: `No sandbox ${sandbox}.`, operation: "run" }),
      ),
    );

const run =
  (disks: Disks["Service"], state: Ref.Ref<State>): Sandboxes["Service"]["run"] =>
  (sandbox, command) =>
    Effect.gen(function* runCommand() {
      const disk = yield* diskOf(state)(sandbox);
      const output = yield* Queue.unbounded<Output, Cause.Done>();
      const input = { chunks: yield* Queue.unbounded<string>(), pending: yield* Ref.make("") };
      const exitCode = yield* Deferred.make<number>();
      const status = runScript(terminalOf(disks, disk)(input, output))(command);

      yield* Effect.forkScoped(
        Effect.flatMap(status, (code) => Effect.andThen(Queue.end(output), Deferred.succeed(exitCode, code))),
      );

      return {
        exit: Deferred.await(exitCode),
        output: Stream.fromQueue(output),
        write: (bytes: Uint8Array) => Effect.asVoid(Queue.offer(input.chunks, decoder.decode(bytes))),
      };
    });

// Opening the disk's root folder proves it exists, as a real vendor refuses a sandbox on a missing disk.
const start =
  (disks: Disks["Service"], state: Ref.Ref<State>): Sandboxes["Service"]["start"] =>
  (disk) =>
    Effect.andThen(
      Effect.mapError(disks.list(disk, ""), (failure) =>
        SandboxProviderError.make({ message: failure.message, operation: "start" }),
      ),
      Ref.modify(state, (current) => {
        const sandbox = SandboxId.make(`memory-sandbox-${current.next}`);

        return [
          sandbox,
          { next: current.next + NEXT, sandboxes: HashMap.set(current.sandboxes, sandbox, disk) },
        ] as const;
      }),
    );

// Sandboxes that run commands in memory, in the tiny subset of sh above, against whatever Disks it is given.
const SandboxesFake: Layer.Layer<Sandboxes, never, Disks> = Layer.effect(
  Sandboxes,
  Effect.gen(function* sandboxesFake() {
    const disks = yield* Disks;
    const state = yield* Ref.make<State>({ next: NEXT, sandboxes: HashMap.empty() });

    return Sandboxes.of({
      run: run(disks, state),
      start: start(disks, state),
      stop: (sandbox) =>
        Ref.update(state, (current) => ({ ...current, sandboxes: HashMap.remove(current.sandboxes, sandbox) })),
    });
  }),
);

export { SandboxesFake };
