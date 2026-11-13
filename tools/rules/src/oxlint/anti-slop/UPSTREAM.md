# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit `13909c9` (ADR 0003). MIT, with `LICENSE` kept beside the code.

## Where upstream's files live here

Every file keeps its upstream name and contents. The only edits are the moves below and the relative import paths those moves need. Paths on the left are upstream's, relative to the vendored root. Files not listed (`index.ts`, `effect/` sources, `shared/`, `vendor/`) keep their upstream paths under `src/oxlint/anti-slop/`.

Rules are grouped into folders of at most 10 (DAL-290):

```text
rules/no-chained-type-assertions.ts                 src/oxlint/anti-slop/rules/types/no-chained-type-assertions.ts
rules/no-known-value-widening.ts                    src/oxlint/anti-slop/rules/types/no-known-value-widening.ts
rules/no-runtime-typeof.ts                          src/oxlint/anti-slop/rules/types/no-runtime-typeof.ts
rules/no-unknown-parameters.ts                      src/oxlint/anti-slop/rules/types/no-unknown-parameters.ts
rules/no-unknown-returns.ts                         src/oxlint/anti-slop/rules/types/no-unknown-returns.ts
rules/no-unknown-type-aliases.ts                    src/oxlint/anti-slop/rules/types/no-unknown-type-aliases.ts
rules/no-unsafe-dictionary-type.ts                  src/oxlint/anti-slop/rules/types/no-unsafe-dictionary-type.ts
rules/no-widen-then-assert.ts                       src/oxlint/anti-slop/rules/types/no-widen-then-assert.ts
rules/require-safety-comment-for-type-assertion.ts  src/oxlint/anti-slop/rules/types/require-safety-comment-for-type-assertion.ts
rules/no-array-filter-map.ts                        src/oxlint/anti-slop/rules/values/no-array-filter-map.ts
rules/no-conditional-empty-object-spread.ts         src/oxlint/anti-slop/rules/values/no-conditional-empty-object-spread.ts
rules/no-object-parameters.ts                       src/oxlint/anti-slop/rules/values/no-object-parameters.ts
rules/no-reduce-accumulator-copy.ts                 src/oxlint/anti-slop/rules/values/no-reduce-accumulator-copy.ts
rules/no-reflect-apply.ts                           src/oxlint/anti-slop/rules/values/no-reflect-apply.ts
rules/no-reflect-get.ts                             src/oxlint/anti-slop/rules/values/no-reflect-get.ts
rules/no-module-mocking.ts                          src/oxlint/anti-slop/rules/conventions/no-module-mocking.ts
rules/no-shape-in-symbol-names.ts                   src/oxlint/anti-slop/rules/conventions/no-shape-in-symbol-names.ts
rules/require-readable-spacing.ts                   src/oxlint/anti-slop/rules/conventions/require-readable-spacing.ts
```

Tests live in the `tests/` mirror (DAL-289), and import the rule through `#oxlint/<path>` instead of a relative `.ts` path. The CLI test drives the plugin entry, so it is named for `index.ts`:

```text
rules/no-chained-type-assertions.test.ts            tests/oxlint/anti-slop/rules/types/no-chained-type-assertions.test.ts
rules/no-known-value-widening.test.ts               tests/oxlint/anti-slop/rules/types/no-known-value-widening.test.ts
rules/no-runtime-typeof.test.ts                     tests/oxlint/anti-slop/rules/types/no-runtime-typeof.test.ts
rules/no-unknown-parameters.test.ts                 tests/oxlint/anti-slop/rules/types/no-unknown-parameters.test.ts
rules/no-unknown-returns.test.ts                    tests/oxlint/anti-slop/rules/types/no-unknown-returns.test.ts
rules/no-unknown-type-aliases.test.ts               tests/oxlint/anti-slop/rules/types/no-unknown-type-aliases.test.ts
rules/no-unsafe-dictionary-type.test.ts             tests/oxlint/anti-slop/rules/types/no-unsafe-dictionary-type.test.ts
rules/no-widen-then-assert.test.ts                  tests/oxlint/anti-slop/rules/types/no-widen-then-assert.test.ts
rules/require-safety-comment-for-type-assertion.test.ts tests/oxlint/anti-slop/rules/types/require-safety-comment-for-type-assertion.test.ts
rules/no-array-filter-map.test.ts                   tests/oxlint/anti-slop/rules/values/no-array-filter-map.test.ts
rules/no-conditional-empty-object-spread.test.ts    tests/oxlint/anti-slop/rules/values/no-conditional-empty-object-spread.test.ts
rules/no-object-parameters.test.ts                  tests/oxlint/anti-slop/rules/values/no-object-parameters.test.ts
rules/no-reduce-accumulator-copy.test.ts            tests/oxlint/anti-slop/rules/values/no-reduce-accumulator-copy.test.ts
rules/no-reflect-apply.test.ts                      tests/oxlint/anti-slop/rules/values/no-reflect-apply.test.ts
rules/no-reflect-get.test.ts                        tests/oxlint/anti-slop/rules/values/no-reflect-get.test.ts
rules/no-module-mocking.test.ts                     tests/oxlint/anti-slop/rules/conventions/no-module-mocking.test.ts
rules/no-shape-in-symbol-names.test.ts              tests/oxlint/anti-slop/rules/conventions/no-shape-in-symbol-names.test.ts
rules/require-readable-spacing.test.ts              tests/oxlint/anti-slop/rules/conventions/require-readable-spacing.test.ts
effect/rules/no-manual-effect-error-tag.test.ts     tests/oxlint/anti-slop/effect/rules/no-manual-effect-error-tag.test.ts
effect/rules/no-manual-tag-comparison.test.ts       tests/oxlint/anti-slop/effect/rules/no-manual-tag-comparison.test.ts
effect/rules/no-manual-tagged-construction.test.ts  tests/oxlint/anti-slop/effect/rules/no-manual-tagged-construction.test.ts
effect/rules/no-service-constructor-imports.test.ts tests/oxlint/anti-slop/effect/rules/no-service-constructor-imports.test.ts
effect/rules/prefer-effect-match.test.ts            tests/oxlint/anti-slop/effect/rules/prefer-effect-match.test.ts
rules/require-readable-spacing-cli.test.ts          tests/oxlint/anti-slop/index.test.ts
```

## Re-syncing

Copy the newer upstream commit's files to the places above, reapply the import paths, and run `pnpm test`. A new upstream rule goes in the folder its domain matches; a folder that would pass 10 files gets split.
