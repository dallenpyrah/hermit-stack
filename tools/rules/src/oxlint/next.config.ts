import { Array as Arr, Record as Rec } from "effect";
import { defineConfig } from "oxlint";
import type { OxlintConfig, OxlintOverride } from "oxlint";

interface Exemption {
  readonly files: readonly string[];
  readonly reason: string;
  readonly rules: readonly string[];
}

interface Environment {
  readonly env: Readonly<Record<string, boolean>>;
  readonly files: readonly string[];
  readonly reason: string;
}

interface StructureOption {
  readonly files: readonly string[];
  readonly options: Readonly<Record<string, readonly string[]>>;
  readonly reason: string;
  readonly rule: string;
}

interface NextOptions {
  readonly buildFiles: readonly string[];
  readonly clientFiles: readonly string[];
}

interface NextStructureOptions {
  readonly appFiles: readonly string[];
}

const entryFiles = ["**/app/**/{page,layout,not-found,robots,sitemap}.{ts,tsx}"];

const cliFiles = ["**/*.cli.ts"];

const toolConfigFiles = ["**/{next,source}.config.ts"];

const routeFiles = ["**/app/**/{page,layout,not-found,route}.{ts,tsx}"];

const segmentConfigFiles = ["**/app/**/{page,layout,route}.{ts,tsx}"];

const rootLayoutFiles = ["**/app/layout.tsx"];

const frameworkFiles = ["**/app/**/{page,layout,not-found,route,robots,sitemap}.{ts,tsx}"];

const frameworkFileNames = ["layout.tsx", "not-found.tsx", "page.tsx", "robots.ts", "route.ts", "sitemap.ts"];

const nextExemptions: readonly Exemption[] = [
  {
    files: entryFiles,
    reason: "Next.js loads the default export of a page, layout, not-found, robots or sitemap file.",
    rules: ["import/no-default-export"],
  },
  {
    files: toolConfigFiles,
    reason:
      "Next.js and Fumadocs load next.config.ts and source.config.ts, which sit at the package root, by their default export.",
    rules: ["import/no-default-export"],
  },
  {
    files: routeFiles,
    reason:
      "Next.js 16 hands a dynamic page or route handler its params as a Promise, and awaits what generateMetadata and GET return.",
    rules: ["oxc/no-async-await"],
  },
  {
    files: segmentConfigFiles,
    reason:
      "Next.js reads route segment config such as dynamic and dynamicParams only from inline export declarations, so a trailing export list is not recognised.",
    rules: ["import/exports-last"],
  },
  {
    files: cliFiles,
    reason:
      "A command-line entry point runs its program at the top level by design, and vitest/require-hook is written for test files.",
    rules: ["vitest/require-hook"],
  },
  {
    files: rootLayoutFiles,
    reason: "Next.js loads the global stylesheet through a side-effect import in the root layout.",
    rules: ["import/no-unassigned-import"],
  },
];

const buildExemption = (files: readonly string[]): Exemption => ({
  files,
  reason:
    "These files run once at build time, where Node's file system, process environment and top-level await are the platform, and the tools that read them (Next.js, Fumadocs, Bun) call them synchronously.",
  rules: [
    "eslint/no-await-in-loop",
    "eslint/no-console",
    "import/no-nodejs-modules",
    "node/no-process-env",
    "node/no-sync",
    "node/no-top-level-await",
    "oxc/no-async-await",
    "unicorn/no-process-exit",
  ],
});

const structureOptionsOf = (options: NextStructureOptions): readonly StructureOption[] => [
  {
    files: options.appFiles,
    options: { roles: ["build"] },
    reason:
      "Next.js and Fumadocs run config helpers, content plugins and file readers only while they build the app, with no Effect runtime, so the app's files may take the .build role.",
    rule: "structure/file-role",
  },
];

const structureOverridesOf = (options: NextStructureOptions): OxlintOverride[] =>
  Arr.map(structureOptionsOf(options), ({ files, options: ruleOptions, rule }) => ({
    files: [...files],
    rules: { [rule]: ["error", ruleOptions] },
  }));

const environmentsOf = (options: NextOptions): readonly Environment[] => [
  {
    env: { browser: true },
    files: frameworkFiles,
    reason:
      "Route handlers and layouts use the web-standard Request, Response and URL globals, which the browser environment declares.",
  },
  {
    env: { node: true },
    files: options.buildFiles,
    reason: "Build-time files read process, console and Buffer, which the node environment declares.",
  },
  {
    env: { browser: true },
    files: options.clientFiles,
    reason: "Client components run in the browser and read window, document and the DOM globals.",
  },
];

const overridesOf = (exemptions: readonly Exemption[]): OxlintOverride[] =>
  Arr.map(exemptions, ({ files, rules }) => ({
    files: [...files],
    rules: Rec.fromEntries(Arr.map(rules, (rule) => [rule, "off"] as const)),
  }));

const next = (options: NextOptions): OxlintConfig =>
  defineConfig({
    overrides: [
      ...Arr.map(environmentsOf(options), ({ env, files }): OxlintOverride => ({ env, files: [...files] })),
      ...overridesOf([...nextExemptions, buildExemption(options.buildFiles)]),
    ],
  });

const nextStructure = (options: NextStructureOptions): OxlintConfig =>
  defineConfig({
    overrides: [
      ...structureOverridesOf(options),
      { files: frameworkFiles, rules: { "structure/file-role": ["error", { skip: frameworkFileNames }] } },
    ],
  });

export { next, nextStructure };

export type { NextOptions, NextStructureOptions };
