import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "oxlint/base": "src/oxlint/base.config.ts",
    "oxlint/domain": "src/oxlint/domain.config.ts",
    "oxlint/next": "src/oxlint/next.config.ts",
    "oxlint/taste": "src/oxlint/taste/taste.plugin.ts",
    "oxlint/structure": "src/oxlint/structure/structure.plugin.ts",
    "oxlint/testing": "src/oxlint/testing/testing.plugin.ts",
    "oxlint/anti-slop/index": "src/oxlint/anti-slop/index.ts",
    "oxlint/anti-slop/effect/index": "src/oxlint/anti-slop/effect/index.ts",
  },
  format: "esm",
  platform: "node",
  dts: false,
  publint: false,
  deps: { neverBundle: ["oxlint", "@oxlint/plugins"] },
});
