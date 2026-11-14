import { base } from "@repo/rules/oxlint";
import { next } from "@repo/rules/oxlint/next";
import { defineConfig } from "oxlint";

// The docs app is the one Next.js app: its build files read the file system, and its views run in the browser.
const docs = next({
  buildFiles: ["apps/docs/**/*.{config,cli,build}.ts"],
  clientFiles: ["apps/docs/**/*.view.tsx"],
});

// The spec reaches a context only through its Api, so it keeps passing when the implementation is rewritten.
const specThroughApiOnly = {
  files: ["spec/**"],
  rules: {
    "eslint/no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["**/contexts/**", "**/src/**", "@repo/*/model", "#src/**"],
            message: "The spec reaches a context only through its Api and the derived client.",
          },
        ],
      },
    ],
  },
} as const;

// An entry point starts its program at the top level by design, and vitest/require-hook is written for test files.
const entryPoints = {
  files: ["**/*.main.ts"],
  rules: { "vitest/require-hook": "off" },
} as const;

// Alchemy loads a stack and a Worker by their module's default export: the CLI imports the stack file, and the bundler
// Builds the Worker's entry around its module's default export.
const alchemyEntries = {
  files: ["services/api/src/**/*.stack.ts", "services/api/src/**/*.worker.ts"],
  rules: { "import/no-default-export": "off" },
} as const;

// A rollout bucket is a 32-bit hash, FNV-1a with MurmurHash3's finaliser, and those are written in XOR and shifts.
const flagBucketHash = {
  files: ["packages/flags/src/evaluate/bucket.pure.ts"],
  rules: { "eslint/no-bitwise": "off" },
} as const;

// An aggregate names each of its commands and a model names each aggregate, policy and view, and every one of those
// Classes has its own file, so these two list files import one module per class. Every other file keeps the cap of 10.
const domainLists = {
  files: ["contexts/**/*.{aggregate,model}.ts", "packages/schedule/**/*.{aggregate,model}.ts"],
  rules: { "import/max-dependencies": ["error", { max: 20 }] },
} as const;

// The local auth database is Node's built-in SQLite, so better-auth runs in a local test with no native build.
const localAuthDatabase = {
  files: ["adapters/better-auth/src/sqlite.layer.ts"],
  rules: { "import/no-nodejs-modules": ["error", { allow: ["node:sqlite"] }] },
} as const;

export default defineConfig({
  ...base,
  ignorePatterns: [...(base.ignorePatterns ?? []), "tools/rules/**"],
  overrides: [
    ...(base.overrides ?? []),
    ...(docs.overrides ?? []),
    specThroughApiOnly,
    entryPoints,
    domainLists,
    flagBucketHash,
    localAuthDatabase,
    alchemyEntries,
  ],
});
