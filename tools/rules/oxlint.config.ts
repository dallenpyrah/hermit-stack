import { defineConfig } from "oxlint";

import { base } from "./src/oxlint/base.config.ts";

export default defineConfig({
  ...base,
  ignorePatterns: [...base.ignorePatterns, "src/oxlint/anti-slop/**", "fixtures/**", "**/*.mjs"],
});
