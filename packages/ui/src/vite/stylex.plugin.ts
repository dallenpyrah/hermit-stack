import { unplugin } from "@stylexjs/unplugin";
import type { UserOptions } from "@stylexjs/unplugin";
import type { Plugin } from "vite";

// SAFETY: @stylexjs/unplugin 0.19.2 types each bundler entry as returning any; its vite entry builds a Vite plugin.
const stylexVite = unplugin.vite as (options: Partial<UserOptions>) => Plugin;

// Every app that renders these components compiles StyleX through this one plugin. A variable's class name is a hash
// Of the file that defines it, so two builds that resolve modules differently would disagree about the tokens.
// CommonJS resolution names a file by its package and path, so `#src/tokens/tokens.stylex.js` inside this package
// And `@repo/ui/tokens.stylex` from an app hash to the same name.
const stylexPlugin = (): Plugin => stylexVite({ unstable_moduleResolution: { type: "commonJS" } });

export { stylexPlugin };
