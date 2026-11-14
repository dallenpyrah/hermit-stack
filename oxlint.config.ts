import { base } from "@repo/rules/oxlint";
import { next } from "@repo/rules/oxlint/next";
import { defineConfig } from "oxlint";

const docs = next({
  buildFiles: ["apps/docs/**/*.{config,cli,build}.ts"],
  clientFiles: ["apps/docs/**/*.view.tsx"],
});

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

const entryPoints = {
  files: ["**/*.main.ts"],
  rules: { "vitest/require-hook": "off" },
} as const;

const flagBucketHash = {
  files: ["packages/flags/src/evaluate/bucket.pure.ts"],
  rules: { "eslint/no-bitwise": "off" },
} as const;

const domainLists = {
  files: ["contexts/**/*.{aggregate,model}.ts", "packages/schedule/**/*.{aggregate,model}.ts"],
  rules: { "import/max-dependencies": ["error", { max: 20 }] },
} as const;

const localAuthDatabase = {
  files: ["adapters/better-auth/src/sqlite.layer.ts"],
  rules: { "import/no-nodejs-modules": ["error", { allow: ["node:sqlite"] }] },
} as const;

const apnsStandIn = {
  files: ["adapters/apns/tests/apns-api.fake.ts"],
  rules: { "import/no-nodejs-modules": ["error", { allow: ["node:http2"] }] },
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
    apnsStandIn,
  ],
});
