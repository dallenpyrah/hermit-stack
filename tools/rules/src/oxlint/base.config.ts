import { recommended } from "@typeonce/oxlint-plugin-effect-machine/recommended";
import { Array as Arr, Record as Rec } from "effect";
import { defineConfig } from "oxlint";

const antiSlop = [
  "no-array-filter-map",
  "no-chained-type-assertions",
  "no-conditional-empty-object-spread",
  "no-known-value-widening",
  "no-module-mocking",
  "no-object-parameters",
  "no-reduce-accumulator-copy",
  "no-reflect-apply",
  "no-reflect-get",
  "no-runtime-typeof",
  "no-shape-in-symbol-names",
  "no-unknown-parameters",
  "no-unknown-returns",
  "no-unknown-type-aliases",
  "no-unsafe-dictionary-type",
  "no-widen-then-assert",
  "require-readable-spacing",
  "require-safety-comment-for-type-assertion",
];

const antiSlopEffect = [
  "no-manual-effect-error-tag",
  "no-manual-tag-comparison",
  "no-manual-tagged-construction",
  "no-service-constructor-imports",
  "prefer-effect-match",
];

const taste = [
  "named-effect-fn",
  "effect-fn-name-matches-binding",
  "no-pipe-on-effect-fn",
  "no-type-predicates",
  "tagged-error-suffix",
  "no-grab-bag-modules",
  "report-message-format",
  "no-unbounded-concurrency",
];

const vagueNames = [
  "data",
  "info",
  "obj",
  "tmp",
  "temp",
  "val",
  "res",
  "ret",
  "foo",
  "bar",
  "baz",
  "stuff",
  "thing",
  "helper",
  "util",
  "manager",
  "misc",
  "impl",
];

const off = {
  "eslint/id-denylist":
    "Also flags object keys that belong to external APIs, such as the data key effect-machine reads; taste/no-vague-names checks declared names only.",
  "eslint/new-cap":
    "Effect class factories such as Schema.TaggedError<...>()() and Context.Service<...>()() are calls by design.",
  "eslint/no-redeclare": "A schema value and its type share a name by design; TypeScript reports real redeclarations.",
  "eslint/one-var": "One declaration per const reads better in generators.",
  "eslint/sort-imports": "Oxfmt owns import order.",
  "import/group-exports": "Inline exports keep each declaration next to its export.",
  "import/no-named-export": "Effect modules export many named values; import/no-default-export is the rule we keep.",
  "import/prefer-default-export": "Contradicts import/no-default-export.",
  "oxc/no-optional-chaining": "Contradicts typescript/prefer-optional-chain; every target runs ES2020.",
  "oxc/no-rest-spread-properties": "Contradicts eslint/prefer-object-spread; every target runs ES2018.",
  "typescript/prefer-readonly-parameter-types":
    "Effect types are not deeply readonly, so every Effect parameter fails.",
  "unicorn/no-array-method-this-argument":
    "Effect's data-first calls such as Array.map(self, f) look like thisArg calls to it.",
  "unicorn/prefer-number-coercion":
    "Contradicts unicorn/prefer-number-properties on parseFloat and parseInt; it rewrites Number.parseFloat(x) to Number(x), which rejects text the parse accepts. We keep prefer-number-properties.",
  "unicorn/prefer-ternary": "Contradicts eslint/no-ternary, which we keep.",
  "unicorn/throw-new-error": "Schema.TaggedError looks like a throw to it.",
  "vitest/no-importing-vitest-globals": "Tests import it and expect from @effect/vitest on purpose.",
  "vitest/no-standalone-expect": "False positive inside @effect/vitest it.layer blocks.",
  "vitest/prefer-to-be-falsy":
    "Contradicts prefer-strict-boolean-matchers, which we keep because toBe(true) and toBe(false) check exact Boolean values.",
  "vitest/prefer-to-be-truthy":
    "Contradicts prefer-strict-boolean-matchers, which we keep because toBe(true) and toBe(false) check exact Boolean values.",
  "vitest/require-test-timeout":
    "Accepts only a numeric literal in each test or vi.setConfig call, so a shared timeout constant fails it; the vitest config sets testTimeout once.",
} as const;

const atError = (prefix: string, rules: readonly string[]): Readonly<Record<string, "error">> =>
  Rec.fromEntries(Arr.map(rules, (rule) => [`${prefix}/${rule}`, "error"] as const));

const base = defineConfig({
  categories: {
    correctness: "error",
    nursery: "error",
    pedantic: "error",
    perf: "error",
    restriction: "error",
    style: "error",
    suspicious: "error",
  },
  ignorePatterns: ["**/dist/**", "/*.config.ts", "**/*.gen.ts"],
  jsPlugins: [
    { name: "anti-slop", specifier: "@repo/rules/oxlint/anti-slop" },
    { name: "anti-slop-effect", specifier: "@repo/rules/oxlint/anti-slop-effect" },
    { name: "taste", specifier: "@repo/rules/oxlint/taste" },
    { name: "testing", specifier: "@repo/rules/oxlint/testing" },
    "@typeonce/oxlint-plugin-effect-machine",
  ],
  options: { typeAware: true },
  overrides: [
    {
      files: ["**/*.plugin.ts"],
      rules: { "import/no-default-export": "off" },
    },
  ],
  plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "promise", "node", "vitest"],
  rules: {
    "eslint/max-lines": ["error", { max: 500, skipBlankLines: false, skipComments: false }],
    "eslint/no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
    "taste/no-vague-names": ["error", ...vagueNames],
    "testing/no-fixed-port": "error",
    "typescript/promise-function-async": ["error", { checkArrowFunctions: false }],
    "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
    "vitest/consistent-test-it": ["error", { fn: "it", withinDescribe: "it" }],
    ...atError("anti-slop", antiSlop),
    ...atError("anti-slop-effect", antiSlopEffect),
    ...atError("taste", taste),
    ...recommended,
    ...Rec.map(off, () => "off" as const),
  },
});

const structure = defineConfig({
  categories: { correctness: "off" },
  ignorePatterns: ["**/dist/**", "**/node_modules/**", "**/fixtures/**"],
  jsPlugins: [{ name: "structure", specifier: "@repo/rules/oxlint/structure" }],
  rules: {
    "structure/barrel-imports": "error",
    "structure/file-role": "error",
    "structure/role-exports": "error",
    "structure/role-imports": "error",
    "structure/vendor-imports": "error",
  },
});

export { base, off, structure, vagueNames };
