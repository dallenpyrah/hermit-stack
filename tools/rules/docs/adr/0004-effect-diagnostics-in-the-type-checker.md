---
status: accepted
date: 2026-11-05
---

# Effect diagnostics run in the type checker, all at error

The typecheck is `effect-tsgo tsrs --noEmit` (TSRS in `@effect/tsgo` 0.67.4). `tsconfig.base.json` sets all 145 non-deprecated Effect diagnostics to error with `ignoreEffectWarningsInTscExitCode: false`, so one type program owns them instead of Oxlint. Deprecated diagnostics (`preferSchemaOverJson`, `effectGenUsesAdapter`) are never listed, because their deprecation warning fails the typecheck.

## Consequences

- Type-aware lint runs through `effect-tsgo --tsrs-lint oxlint` instead of tsgolint. That path is experimental and its adoption is still proposed.
- `effect-tsgo tsc` stays the fallback, and editors use tsgo.
