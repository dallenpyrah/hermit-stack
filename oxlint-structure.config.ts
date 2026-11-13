import { structure } from "@repo/rules/oxlint";
import { domainStructure } from "@repo/rules/oxlint/domain";
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
