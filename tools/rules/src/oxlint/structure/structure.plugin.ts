import { definePlugin } from "@oxlint/plugins";

import { barrelImports } from "./barrel-imports.rule.js";
import { fileRole } from "./file-role.rule.js";
import { roleExports } from "./role-exports.rule.js";
import { roleImports } from "./role-imports.rule.js";
import { vendorImports } from "./vendor-imports.rule.js";

export default definePlugin({
  meta: { name: "structure" },
  rules: {
    "barrel-imports": barrelImports,
    "file-role": fileRole,
    "role-exports": roleExports,
    "role-imports": roleImports,
    "vendor-imports": vendorImports,
  },
});
