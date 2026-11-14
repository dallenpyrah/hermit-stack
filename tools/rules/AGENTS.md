# @repo/rules

The lint and type rules, and the scripts behind `pnpm check`, for hermit-stack. Copied from `rika-labs/rules` and owned here: [UPSTREAM.md](./UPSTREAM.md) records the commit it came from and every change since. Rules about one context's or app's design live with that package, not here.

Read before you change anything:

- [CONTEXT.md](./CONTEXT.md): the language of this package.
- [docs/adr/](./docs/adr/): why the rules are shaped this way. The ADRs are upstream's and stay as written.
- `node_modules/effect/AGENTS.md`: the Effect idioms the taste rules encode. Read it first.
- `.agent_sources/`: the source of Effect and effect-machine at the versions the catalog pins. `pnpm agent-sources` at the repo root clones it from `agent-sources.json`, and reruns update it after a pin changes. Read it instead of guessing an API from memory or newer docs.

## Commands

Run each from the repo root through mise (`mise exec -- pnpm <script>`), so the pinned Node, pnpm, Bun and gitleaks are used.

- `pnpm check`: `turbo boundaries`, then one Turbo run of every package's format check, typecheck, lint, tests and build, the file-role pass, and the root checks below. `pnpm check:affected` is `pnpm check --affected`: the same tasks, limited to those whose inputs changed on this branch. Done means `pnpm check` exits 0.
- `pnpm exec turbo run test --filter=@repo/rules`: this package's suite. It lints the deterministic fixtures in `fixtures/`, runs the vendored anti-slop rule tests and the testing plugin's tests with `node --test`, and drives each CLI against a scratch repo. Some suites also assert this repo's wiring at the root: `check` running the ratchet and `lint:scripts`, `check:affected` matching `check`, and `agent-sources.json`. It depends on `build` and on `//#runtime-pins`, which fails when the Node or Bun on `PATH` is not the one `mise.toml` pins.
- `pnpm knip`: unused files, exports, dependencies and catalog entries in every workspace package. Each exception sits in the root `knip.config.ts` with its reason.
- `pnpm ratchet` (`src/ratchet/ratchet.cli.mjs`): counts knip exceptions, Oxlint rules turned off, override scopes and ignore patterns, quieted tsconfig diagnostics, inline suppressions, files over 500 lines, patched dependencies, trust-policy exceptions, tests outside the `src/` mirror and folders over 10 code files, and fails when any count differs from the root `ratchets.json`. `pnpm exec ratchet --print` prints the current counts (`docs/ratchet.md`).
- `pnpm lint:inputs` (`src/turbo/task-inputs.cli.mjs`): runs `turbo run --dry=json` for every task and fails when a `typecheck`, `lint`, `test` or `test:*` task does not hash a file under its package's `src/` or `tests/`, because Turbo would then replay a cached pass after that file changed. A package that extends the root `turbo.json` and keeps its `src/` and `tests/` passes; a package that overrides `inputs` starts them with `$TURBO_EXTENDS$`. It also fails an input outside the repo that hashes no file: Turbo 2.11.11 hashes nothing through a symlinked folder and drops outside inputs from root (`//#`) tasks.
- `pnpm lint:paths` (`src/docs/doc-paths.cli.mjs`): fails when a path written in backticks in a tracked Markdown file does not exist. A path counts when it starts with `./` or `../`, or when its first folder exists beside the doc or at the repo root. Globs such as `apps/web/**`, placeholders such as `<app>/src/app.layer.ts`, fenced code, URLs, a package's own export subpaths, generated folders and the vendored anti-slop docs are skipped.
- `pnpm lint:env` (`src/env/rules-env.cli.mjs`): fails when code reads `process.env`, `Bun.env` or `import.meta.env` by a name the root `.env.schema`, or a schema it `@import`s, does not declare, or by a computed name. It reads the schema file itself and does not need varlock. It does not see a read through Effect `Config`, which is how hermit-stack's code reads configuration, so declare each `Config` name in `.env.schema` by hand.
- `pnpm lint:scripts` (`src/fence/check-scripts.cli.mjs`): fails when `check:affected` would run a different task list from `check`.
- `pnpm gitleaks`: secrets in the whole git history, through the gitleaks `mise.toml` pins. Turbo keys it on the tracked files, so a history-only change is caught by the pre-commit hook, which scans every staged change.
- `pnpm sherif`: `package.json` consistency across the workspace.
- `pnpm boundaries`: `turbo boundaries`, the dependency direction between package tags and undeclared imports. This package's `turbo.json` lists the packages only the fixtures import under `boundaries.implicitDependencies`, so its real source is still checked.
- `pnpm lint:structure`: the deterministic `structure` rules over every file in the repo (ADR 0006).
- `pnpm fmt`: format with oxfmt. It skips `fixtures/`, `src/oxlint/anti-slop/` and `tests/oxlint/anti-slop/`, which stay byte for byte as measured or vendored.
- Git hooks (lefthook, installed by `pnpm install`): pre-commit formats staged files, checks the line cap and inline suppressions, scans for secrets, checks boundaries, then typechecks, lints and runs the file-role pass. Hooks never run tests.
- `src/fence/git-fence.cli.mjs` (`git-fence`): a policy an agent hook can run before each shell command and file write. It answers in the form Claude Code, Cursor or Pi expects, but hermit-stack ships no agent config, so nothing runs it until a fork wires its own agent. It refuses `--no-verify`, `git commit -n`, `core.hooksPath` changes, `LEFTHOOK=0` and its relatives, `lefthook uninstall` and writes into `.git/hooks`. What it covers and what it cannot close is in `docs/git-fence.md`.
- `src/mutants/mutants.cli.mjs` (`mutants`): reads `mutants.out/outcomes.json` after `mutant-cafe` and fails on a mutant no test kills or explains (`docs/mutants.md`). No package runs it yet.

## Do not

- Do not skip hooks with `--no-verify`.
- Do not add a file whose name does not end in its role, `<kebab-name>.<role>.<ext>` (ADR 0006). The role list lives in `src/oxlint/structure/roles.pure.ts`.
- Do not turn a rule off anywhere but the off table in `src/oxlint/base.config.ts`, and never without a reason (ADR 0002).
- Do not read an environment variable `.env.schema` does not declare, or read one by a computed name. Read it through Effect `Config` under the schema's name, with `Config.redacted` for a sensitive one.
- Do not add a knip exception without its reason in `knip.config.ts`; delete the dead code instead when you can.
- Do not raise a number in `ratchets.json` without saying why in the same commit, and do not leave it above the real count.
- Do not list deprecated Effect diagnostics (`preferSchemaOverJson`, `effectGenUsesAdapter`) in `tsconfig.base.json`. The warning fails every package's typecheck (ADR 0004).
- Do not edit `src/oxlint/anti-slop` or `tests/oxlint/anti-slop` by hand. Re-vendor a newer upstream commit instead, placing each file where `src/oxlint/anti-slop/UPSTREAM.md` maps it (ADR 0003).
- Do not write a file over 500 lines, Markdown included.
- Do not change a copied file without recording the change in `UPSTREAM.md`.
- Do not push, publish or add a git remote.
- Do not report a result you did not measure.

## Layout

- `src/oxlint/base.config.ts`: the Oxlint base config, the off table and the `structure` config. `src/oxlint/domain.config.ts`: `domainStructure`, which turns on Alchemy Domain's roles for the files it is given. `src/oxlint/effect-call-syntax.pure.ts`: AST helpers both plugins share, imported as `#oxlint/...`.
- `src/oxlint/taste/`: the taste plugin, one `.rule.ts` per rule. `src/oxlint/testing/`: the testing plugin, whose `no-fixed-port` fails a test that binds a fixed port. `src/oxlint/structure/`: the file-role plugin (`file-role`, `role-imports`, `role-exports`), the role table, `vendor-imports` with its list of banned vendor SDKs (`vendor-sdks.pure.ts`) and `barrel-imports`. `src/oxlint/anti-slop`: vendored anti-slop, with its tests in the `tests/oxlint/anti-slop/` mirror.
- `tsconfig.base.json`: strict TypeScript and every Effect diagnostic at error. The root `tsconfig.base.json` extends it.
- `src/agent-sources/`, `src/env/`, `src/fence/`, `src/ratchet/`, `src/docs/`, `src/mutants/` and `src/turbo/`: the CLIs listed above, each a `.cli.mjs` with its `.pure.mjs` logic.
- `tests/`: the tests, mirroring `src/`. A suite that drives a CLI is named for that `.cli.mjs`, and `tests/oxlint/base.config.test.mjs` lints the fixtures under `fixtures/<plugin>/<rule>/`.
- `dist/`: the built Oxlint plugins the root configs load. `build` writes it, and every `lint` and the file-role pass depend on it.
