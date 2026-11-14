import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vite";

import { stylexPlugin } from "@repo/ui/vite";

import { ledgerApi } from "./src/vite/ledger-api.plugin.ts";

const port = 4310;

const ssr = { build: true, clientEntry: "/src/entry/browser.main.ts", serverEntry: "/src/entry/server.page.ts" };

const developmentBuildIdThatSurvivesRestartsWhileTheBrowserCachesFoldkit = "development";

const foldkitOptions = {
  build: { devToolsMcpPort: false, ssr },
  serve: { buildId: developmentBuildIdThatSurvivesRestartsWhileTheBrowserCachesFoldkit, devToolsMcpPort: false, ssr },
};

export default defineConfig(({ command }) => ({
  plugins: [stylexPlugin(), ledgerApi(), foldkit(foldkitOptions[command])],
  server: { port, strictPort: true },
}));
