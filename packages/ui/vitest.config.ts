import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vitest/config";

import { stylexPlugin } from "./src/vite/stylex.plugin.ts";

export default defineConfig({
  plugins: [stylexPlugin(), foldkit({ devToolsMcpPort: false })],
  test: {
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    pool: "threads",
    testTimeout: 30_000,
  },
});
