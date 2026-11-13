import { base } from "@repo/rules/oxlint";
import { defineConfig } from "oxlint";

export default defineConfig({
  ...base,
  ignorePatterns: [...(base.ignorePatterns ?? []), "tools/rules/**"],
  overrides: [
    ...(base.overrides ?? []),
    {
      // The spec reaches a context only through its Api, so it keeps passing when the implementation is rewritten.
      files: ["spec/**"],
      rules: {
        "eslint/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["**/contexts/**", "**/src/**", "@repo/*/model", "#src/**"],
                message: "The spec reaches a context only through its Api and the derived client.",
              },
            ],
          },
        ],
      },
    },
  ],
});
