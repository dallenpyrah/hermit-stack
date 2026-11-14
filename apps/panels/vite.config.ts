import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vite";

import { stylexPlugin } from "@repo/ui/vite";

import { singleFile } from "./src/build/single-file.plugin.ts";

export default defineConfig({
  base: "./",
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    emptyOutDir: true,
    modulePreload: false,
    outDir: "dist",
    rolldownOptions: { input: { account: "account.html" } },
  },
  plugins: [stylexPlugin(), foldkit({ devToolsMcpPort: false }), singleFile()],
});
