# Ratchets

`src/ratchet/ratchet.cli.mjs` (`pnpm ratchet`, a Turbo task in `pnpm check`) counts the exceptions a repo allows today and compares each count with `ratchets.json` at the repo root. Any difference fails the check.

## What it counts

| count                                      | source                                                                                                                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `knip.config.ts exceptions`                | every path in `entry` and in each `ignore*` field, at the root and in each workspace. An `ignoreIssues` glob counts once per issue type it hides.                                                                                                  |
| `<config> rules off`                       | rules set to `off` in `oxlint.config.ts` and `oxlint-structure.config.ts`, inherited ones included                                                                                                                                                 |
| `<config> override rules per glob`         | for each override in the same configs, its file globs times its rules: every place a rule is scoped differently from the base                                                                                                                      |
| `<config> ignore patterns`                 | the config's `ignorePatterns`: paths the linter never reads                                                                                                                                                                                        |
| `<tsconfig> diagnostics off`               | in each `tsconfig*.json`: `@effect/language-service` diagnostics set to `off`, `suggestion` or `message`, `ignoreEffectWarningsInTscExitCode: true`, strict checks set to `false`, and `allowUnreachableCode` or `allowUnusedLabels` set to `true` |
| `<tsconfig> override diagnostics per glob` | for each language-service override in the same file, its `include` globs times the diagnostics it quiets                                                                                                                                           |
| `<tsconfig> allowed unstable APIs`         | the language service's `allowedUnstableApis`: unstable modules the package may import                                                                                                                                                              |
| `inline suppressions`                      | `oxlint-disable`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck` in tracked and untracked source files                                                                                                                       |
| `files over 500 lines`                     | Text files over 500 lines that `file-fence` caps, listed by path when the count grows; lockfiles, patches, `.gen` files, vendored and built code, generated baselines and `package.json` manifests are uncapped                                    |
| `patched dependencies`                     | entries under `patchedDependencies` in `pnpm-workspace.yaml` and in `package.json`'s `pnpm` field                                                                                                                                                  |
| `equivalent mutants`                       | entries in every tracked or untracked `mutants.equivalent.json`, counted only when the repo has one                                                                                                                                                |
| `baseline surviving mutants`               | entries in every tracked or untracked `mutants.baseline.json`, counted only when the repo has one                                                                                                                                                  |

A tsconfig that turns nothing off has no entry, so a package's first override fails as a count with no baseline.

`trust policy exceptions` counts the package entries under `trustPolicyExclude` in `pnpm-workspace.yaml`, excluding comments. A repo without an exception has no entry. Each approved version must be counted, and removing one requires lowering the ratchet in the same commit.

## Measured counts

Some counts come from a measurement rather than from the repo's files, such as the gzip bytes of a Worker bundle. The task that measures one writes a JSON object of whole numbers, `{ "<name>": <count> }`, and the ratchet reads it with `--counts <file>` (repeatable, relative to the repo root). Each name gets a baseline in `ratchets.json` and fails the same ways as the counts above. A `--counts` file that is missing, holds no counts, holds a value that isn't a whole number of 0 or more, or reuses a built-in count's name fails before any comparison. Run the measuring task before the ratchet, for example as a Turbo `dependsOn` of the ratchet task, so its output can come from the cache.

## How it fails

- A count above its baseline fails. To raise the baseline, edit `ratchets.json` in the same commit and say why in the commit message, so the raise shows in review.
- A count below its baseline also fails, until `ratchets.json` is lowered in the same commit. Otherwise the room left over lets the next exception in without anyone seeing it.
- A count with no baseline, or a baseline entry with nothing left to count, fails too.

`pnpm exec ratchet --print`, from the repo root, prints the current counts in the shape of `ratchets.json`.

## Not counted yet

- Measured sizes, such as a Worker bundle's bytes. No package writes a `--counts` file yet.
- Knip findings. `pnpm knip` already fails on any finding, so the number is held at zero. The ratchet counts the exceptions that hide findings instead.
