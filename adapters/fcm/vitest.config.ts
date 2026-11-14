import { defineConfig } from "vitest/config";

export default defineConfig({
  // The gate runs every suite at once, so on a busy machine a test can outlast Vitest's 5 s default.
  test: {
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    pool: "threads",
    testTimeout: 30_000,
  },
});
