import * as Arr from "effect/Array";
import * as Record from "effect/Record";
import type { KnipConfig } from "knip";

interface Exception {
  readonly paths: ReadonlyArray<string>;
  readonly reason: string;
}

const entries: ReadonlyArray<Exception> = [
  {
    paths: [".pi/extensions/git-fence.adapter.js", ".amp/plugins/git-fence.adapter.js"],
    reason:
      "The Pi extension and the Amp plugin that run the git fence. Pi loads every file in .pi/extensions and Amp every file in .amp/plugins, so nothing imports them.",
  },
];

const fixtures: ReadonlyArray<Exception> = [
  {
    paths: ["fixtures/**"],
    reason:
      "Deterministic lint fixtures and the config that lints them. They are data for tests/oxlint/base.config.test.mjs, and their test files would otherwise be node --test entries.",
  },
];

const vendoredExports: ReadonlyArray<Exception> = [
  {
    paths: ["src/oxlint/anti-slop/shared/**", "src/oxlint/anti-slop/vendor/**"],
    reason:
      "Vendored byte for byte from dmmulroy/anti-slop (ADR 0003), so its unused exports stay as upstream wrote them.",
  },
];

const notPackages: ReadonlyArray<Exception> = [
  {
    paths: ["@effect/language-service"],
    reason:
      "The plugin name tsconfig.base.json configures. effect-tsgo (@effect/tsgo) reads it, and the package is never installed.",
  },
];

const systemBinaries: ReadonlyArray<Exception> = [
  {
    paths: ["mise"],
    reason: "The tool-version manager that pins gitleaks in mise.toml. It is installed on the machine, not from npm.",
  },
];

const pathsOf = (exceptions: ReadonlyArray<Exception>): Array<string> =>
  Arr.flatMap(exceptions, (exception) => exception.paths);

const exportIssues: Array<"exports" | "types"> = ["exports", "types"];

const config: KnipConfig = {
  entry: pathsOf(entries),
  ignore: pathsOf(fixtures),
  ignoreDependencies: pathsOf(notPackages),
  ignoreBinaries: pathsOf(systemBinaries),
  ignoreIssues: Record.fromEntries(Arr.map(pathsOf(vendoredExports), (glob) => [glob, exportIssues])),
};

export default config;
