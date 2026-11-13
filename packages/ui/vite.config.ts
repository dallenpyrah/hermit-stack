import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vite";

import { stylexPlugin } from "./src/vite/stylex.plugin.ts";

// The package's own build is its gallery: every component, variant and size in both themes.
export default defineConfig({
  build: { emptyOutDir: true, outDir: "../dist" },
  plugins: [stylexPlugin(), foldkit({ devToolsMcpPort: false })],
  root: "gallery",
});
