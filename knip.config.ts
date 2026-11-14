import * as Arr from "effect/Array";
import * as Record from "effect/Record";
import type { KnipConfig } from "knip";

interface Exception {
  readonly paths: ReadonlyArray<string>;
  readonly reason: string;
}

const fixtures: ReadonlyArray<Exception> = [
  {
    paths: ["fixtures/**"],
    reason:
      "Deterministic lint fixtures in tools/rules and the config that lints them. They are data for its tests, and their test files would otherwise be entries.",
  },
];

const vendoredExports: ReadonlyArray<Exception> = [
  {
    paths: ["src/oxlint/anti-slop/shared/**", "src/oxlint/anti-slop/vendor/**"],
    reason:
      "Vendored byte for byte from dmmulroy/anti-slop into tools/rules (ADR 0003), so its unused exports stay as upstream wrote them.",
  },
];

const templateImports: ReadonlyArray<Exception> = [
  {
    paths: ["**/package.json"],
    reason:
      "Each package copies packages/kernel's package.json, whose imports map #tests/* for the fakes and workloads in tests/. A new package keeps that entry before it has its first one.",
  },
];

const pendingCatalog: ReadonlyArray<Exception> = [
  {
    paths: ["pnpm-workspace.yaml"],
    reason:
      "The catalog pins every package the template's apps, contexts, services and infra will use, ahead of the packages that use them. Remove this once each entry has a consumer.",
  },
];

const notPackages: ReadonlyArray<Exception> = [
  {
    paths: ["@effect/language-service"],
    reason:
      "The plugin name tsconfig.base.json configures. effect-tsgo (@effect/tsgo) reads it, and the package is never installed.",
  },
];

const docExamples: ReadonlyArray<Exception> = [
  {
    paths: [
      "@repo/kernel",
      "@repo/conformance",
      "@repo/ledger",
      "@repo/outbound",
      "@repo/schedule",
      "@repo/ui",
      "@alchemy.run/domain",
      "@stylexjs/stylex",
      "foldkit",
    ],
    reason:
      "The code blocks in the docs pages import them. They are written to the generated .fences folder and typechecked there, which knip does not read.",
  },
];

const systemBinaries: ReadonlyArray<Exception> = [
  {
    paths: ["mise"],
    reason:
      "The tool-version manager that pins Node, pnpm and gitleaks in mise.toml. It is installed on the machine, not from npm.",
  },
];

const pathsOf = (exceptions: ReadonlyArray<Exception>): Array<string> =>
  Arr.flatMap(exceptions, (exception) => exception.paths);

const exportIssues: Array<"exports" | "types"> = ["exports", "types"];

const config: KnipConfig = {
  ignoreIssues: {
    ...Record.fromEntries(Arr.map(pathsOf(templateImports), (glob) => [glob, ["subpaths"]])),
    ...Record.fromEntries(Arr.map(pathsOf(pendingCatalog), (glob) => [glob, ["catalog"]])),
  },
  workspaces: {
    "apps/docs": { ignoreDependencies: pathsOf(docExamples) },
    "tools/rules": {
      ignore: pathsOf(fixtures),
      ignoreIssues: Record.fromEntries(Arr.map(pathsOf(vendoredExports), (glob) => [glob, exportIssues])),
    },
  },
  ignoreDependencies: pathsOf(notPackages),
  ignoreBinaries: pathsOf(systemBinaries),
};

export default config;
