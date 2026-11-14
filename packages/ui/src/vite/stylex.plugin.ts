import { unplugin } from "@stylexjs/unplugin";
import type { UserOptions } from "@stylexjs/unplugin";
import type { Plugin } from "vite";

// SAFETY: @stylexjs/unplugin 0.19.2 types each bundler entry as returning any; its vite entry builds a Vite plugin.
const stylexVite = unplugin.vite as (options: Partial<UserOptions>) => Plugin;

const stylexPlugin = (): Plugin => stylexVite({ unstable_moduleResolution: { type: "commonJS" } });

export { stylexPlugin };
