import { definePlugin } from "@oxlint/plugins";

import { noFixedPort } from "./no-fixed-port.rule.js";

export default definePlugin({
  meta: { name: "testing" },
  rules: {
    "no-fixed-port": noFixedPort,
  },
});
