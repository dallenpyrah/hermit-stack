import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vite";

import { stylexPlugin } from "./src/vite/stylex.plugin.ts";

export default defineConfig({
  build: { emptyOutDir: true, outDir: "../dist" },
  plugins: [stylexPlugin(), foldkit({ devToolsMcpPort: false })],
  root: "gallery",
});
