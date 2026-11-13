import { defineConfig } from "oxlint";

import { base } from "../src/oxlint/base.config.ts";

export default defineConfig({ ...base, options: { typeAware: false } });
