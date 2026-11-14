import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vitest/config";

import { stylexPlugin } from "@repo/ui/vite";

// StyleX must compile the views under test too: an uncompiled stylex.create throws when it runs.
export default defineConfig({
  plugins: [stylexPlugin(), foldkit({ devToolsMcpPort: false })],
  // The gate runs every suite at once, so on a busy machine a test can outlast Vitest's 5 s default.
  test: {
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    pool: "threads",
    testTimeout: 30_000,
  },
});
