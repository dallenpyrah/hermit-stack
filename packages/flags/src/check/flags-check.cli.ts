import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer as nodeServices } from "@effect/platform-node/NodeServices";
import {
  Array as Arr,
  Console,
  DateTime,
  Effect,
  FileSystem,
  Option,
  Path,
  Record as Rec,
  Schema,
  Stdio,
  String as Str,
} from "effect";
import type { PlatformError } from "effect/PlatformError";
import { createServer, createServerModuleRunner } from "vite";
import type { ViteDevServer } from "vite";

import { flagProblems } from "#src/check/flag-check.pure.ts";
import type { Declared } from "#src/check/flag-check.pure.ts";

// Finds every *.flag.ts under the folder given as the first argument, or the working directory, loads it, and exits non-zero naming each flag past its removeBy or
// ReviewBy date. Fixtures are skipped so a test can keep a flag dated in the past.

class FlagCheckError extends Schema.TaggedError<FlagCheckError, { readonly brand: unique symbol }>()("FlagCheckError", {
  message: Schema.String,
}) {}

const ModuleExports = Schema.Record(Schema.String, Schema.Unknown);

const skippedFolders = new Set(["dist", "fixtures", "node_modules"]);

const isSkipped = (name: string): boolean => Str.startsWith(".")(name) || skippedFolders.has(name);

const findFlagFiles = (
  directory: string,
): Effect.Effect<readonly string[], PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* findFlagFilesIn() {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const names = yield* fileSystem.readDirectory(directory);

    const found = yield* Effect.forEach(names, (name) => {
      const entry = path.join(directory, name);

      if (isSkipped(name)) {
        return Effect.succeed([]);
      }

      if (Str.endsWith(".flag.ts")(name)) {
        return Effect.succeed([entry]);
      }

      return Effect.flatMap(fileSystem.stat(entry), (stat) => {
        if (stat.type === "Directory") {
          return findFlagFiles(entry);
        }

        return Effect.succeed([]);
      });
    });

    return Arr.flatten(found);
  });

// A flag file imports TypeScript with .js specifiers and workspace packages by their source, which only Vite resolves.
const startVite = (root: string): Effect.Effect<ViteDevServer, FlagCheckError> =>
  Effect.tryPromise({
    catch: (cause) => FlagCheckError.make({ message: `Vite could not start: ${String(cause)}` }),
    try: () =>
      createServer({
        appType: "custom",
        configFile: false,
        logLevel: "silent",
        optimizeDeps: { noDiscovery: true },
        root,
        server: { hmr: false, middlewareMode: true, watch: { ignored: ["**/*"] } },
      }),
  });

const loadFlagFiles = (
  root: string,
  files: readonly string[],
): Effect.Effect<readonly Declared[], FlagCheckError, Path.Path> =>
  Effect.acquireUseRelease(
    startVite(root),
    (server) =>
      Effect.gen(function* loadEachFile() {
        const path = yield* Path.Path;
        const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });

        const loaded = yield* Effect.forEach(files, (file) => {
          const relative = path.relative(root, file);

          return Effect.tryPromise({
            catch: (cause) => FlagCheckError.make({ message: `${relative} did not load: ${String(cause)}` }),
            try: () => runner.import(file),
          }).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(ModuleExports)),
            Effect.mapBoth({
              onFailure: (cause) => FlagCheckError.make({ message: `${relative} did not load: ${String(cause)}` }),
              onSuccess: (exports) =>
                Arr.map(Rec.toEntries(exports), ([exportName, value]) => ({ exportName, file: relative, value })),
            }),
          );
        });

        yield* Effect.promise(() => runner.close());

        return Arr.flatten(loaded);
      }),
    (server) => Effect.promise(() => server.close()),
  );

const rootFolder = Effect.gen(function* rootFolder() {
  const path = yield* Path.Path;
  const stdio = yield* Stdio.Stdio;
  const args = yield* stdio.args;

  return path.resolve(Option.getOrElse(Arr.head(args), () => "."));
});

const checkFlags = Effect.gen(function* checkFlags() {
  const root = yield* rootFolder;
  const files = yield* findFlagFiles(root);
  const declared = yield* loadFlagFiles(root, files);
  const now = yield* DateTime.now;
  const problems = flagProblems(declared, DateTime.formatIsoDateUtc(now));

  if (Arr.isReadonlyArrayEmpty(problems)) {
    return yield* Console.log(`flags:check: ${files.length} .flag.ts files under ${root}, none past its date.`);
  }

  yield* Effect.forEach(problems, (problem) => Console.error(problem));

  return yield* FlagCheckError.make({ message: `${problems.length} flags are past their date or cannot be read.` });
});

runMain(Effect.provide(checkFlags, nodeServices));
