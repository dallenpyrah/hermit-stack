import { base } from "@repo/rules/oxlint";
import { defineConfig } from "oxlint";

export default defineConfig({
  ...base,
  ignorePatterns: [...(base.ignorePatterns ?? []), "tools/rules/**"],
});
