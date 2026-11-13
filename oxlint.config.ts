import { base } from "@repo/rules/oxlint";
import { next } from "@repo/rules/oxlint/next";
import { defineConfig } from "oxlint";

// The docs app is the one Next.js app: its build files read the file system, and its views run in the browser.
const docs = next({
  buildFiles: ["apps/docs/**/*.{config,cli,build}.ts"],
  clientFiles: ["apps/docs/**/*.view.tsx"],
});

export default defineConfig({
  ...base,
  ignorePatterns: [...(base.ignorePatterns ?? []), "tools/rules/**"],
  overrides: [...(base.overrides ?? []), ...(docs.overrides ?? [])],
});
