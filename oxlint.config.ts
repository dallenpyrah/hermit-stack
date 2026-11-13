import { base } from "@repo/rules/oxlint";
import { defineConfig } from "oxlint";

export default defineConfig({
  ...base,
  ignorePatterns: [...(base.ignorePatterns ?? []), "tools/rules/**"],
  overrides: [
    ...(base.overrides ?? []),
    {
      // A browser entry point starts its FoldKit program at the top level by design, and vitest/require-hook is written for test files.
      files: ["packages/ui/gallery/*.main.ts"],
      rules: { "vitest/require-hook": "off" },
    },
  ],
});
