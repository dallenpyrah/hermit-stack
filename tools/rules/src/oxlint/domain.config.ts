import { defineConfig } from "oxlint";
import type { OxlintConfig } from "oxlint";

import { domainRoles } from "./structure/roles.pure.js";
import type { Role } from "./structure/roles.pure.js";

interface DomainStructureOptions {
  readonly exports?: Readonly<Record<string, string>>;
  readonly files: readonly string[];
  readonly packages?: readonly string[];
}

const domainPackages: readonly string[] = ["@alchemy.run/domain"];

const domainEdges: Readonly<Partial<Record<Role, readonly Role[]>>> = {
  api: ["command", "context", "middleware", "model", "query", "stream", "view"],
  command: ["context", "event", "id", "middleware", "pure", "rejection", "schema"],
  model: [...domainRoles, "api", "command", "pure", "schema", "view"],
  schema: ["api", "contract", "errors", "id", "schema"],
  view: ["aggregate", "command", "context", "event", "id", "middleware", "pure", "rejection", "schema", "service"],
};

const domainStructure = (options: DomainStructureOptions): OxlintConfig =>
  defineConfig({
    overrides: [
      {
        files: [...options.files],
        rules: {
          "structure/file-role": ["error", { roles: [...domainRoles, "command", "model"] }],
          "structure/role-imports": [
            "error",
            {
              edges: domainEdges,
              exports: { ...options.exports },
              packages: [...domainPackages, ...(options.packages ?? [])],
            },
          ],
        },
      },
    ],
  });

export { domainStructure };
