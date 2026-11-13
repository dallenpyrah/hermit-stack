import { structure } from "@repo/rules/oxlint";
import { domainStructure } from "@repo/rules/oxlint/domain";
import { nextStructure } from "@repo/rules/oxlint/next";
import { roleImports } from "@repo/rules/oxlint/role-imports";
import { defineConfig } from "oxlint";

const imports = roleImports(import.meta.dirname, ["@repo/"]);

// Alchemy Domain's roles (aggregate, command, event, projection and the rest) apply where a Domain model lives.
const domain = domainStructure({
  exports: imports.exports,
  files: ["contexts/**", "packages/schedule/**"],
  packages: imports.packages,
});

// FoldKit's roles (command, message, model, subscription, update) apply where a FoldKit app or component lives.
const foldkitFiles = ["apps/web/**", "apps/panels/**", "packages/ui/**", "packages/client-data/**"];
const foldkitRoles = ["command", "message", "model", "subscription", "update"];
const foldkitPackages = ["foldkit", "@foldkit/ui", "@stylexjs/stylex"];

// The docs app is Next.js: its framework files keep Next's names, and its build-time helpers take the .build role.
const docs = nextStructure({ appFiles: ["apps/docs/**"] });

export default defineConfig({
  ...structure,
  ignorePatterns: [
    ...(structure.ignorePatterns ?? []),
    "tools/rules/src/oxlint/anti-slop/**",
    "tools/rules/tests/oxlint/anti-slop/**",
  ],
  overrides: [
    ...(structure.overrides ?? []),
    ...(domain.overrides ?? []),
    ...(docs.overrides ?? []),
    {
      files: foldkitFiles,
      rules: {
        "structure/file-role": ["error", { roles: foldkitRoles }],
        "structure/role-imports": ["error", { ...imports, packages: [...imports.packages, ...foldkitPackages] }],
      },
    },
  ],
  rules: {
    ...structure.rules,
    "structure/role-imports": ["error", imports],
  },
});
