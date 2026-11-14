import { structure } from "@repo/rules/oxlint";
import { domainStructure } from "@repo/rules/oxlint/domain";
import { nextStructure } from "@repo/rules/oxlint/next";
import { roleImports } from "@repo/rules/oxlint/role-imports";
import { defineConfig } from "oxlint";

const imports = roleImports(import.meta.dirname, ["@repo/"]);

const domain = domainStructure({
  exports: imports.exports,
  files: ["contexts/**", "packages/schedule/**"],
  packages: imports.packages,
});

const identity = domainStructure({
  exports: imports.exports,
  files: ["packages/identity/**"],
  packages: imports.packages,
});

const foldkitFiles = ["apps/web/**", "apps/panels/**", "packages/ui/**", "packages/client-data/**"];
const foldkitRoles = ["command", "message", "model", "subscription", "update"];
const foldkitPackages = ["foldkit", "@foldkit/ui", "@stylexjs/stylex"];

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
    ...(identity.overrides ?? []),
    ...(docs.overrides ?? []),
    {
      files: foldkitFiles,
      rules: {
        "structure/file-role": ["error", { roles: foldkitRoles }],
        "structure/role-imports": ["error", { ...imports, packages: [...imports.packages, ...foldkitPackages] }],
      },
    },
    {
      files: ["apps/web/**"],
      rules: {
        "structure/role-imports": [
          "error",
          { ...imports, packages: [...imports.packages, ...foldkitPackages, "@alchemy.run/domain/Foldkit"] },
        ],
      },
    },
  ],
  rules: {
    ...structure.rules,
    "structure/role-imports": ["error", imports],
  },
});
