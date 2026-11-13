# @rikalabs/rules

Lint and type rules shared by every Rika Labs repo. Rules about one product's design live in that product's repo, never here.

Read before you change anything:

- [CONTEXT.md](./CONTEXT.md): the language of this repo.
- [docs/adr/](./docs/adr/): why the rules are shaped this way.
- `node_modules/effect/AGENTS.md`: the Effect idioms the taste rules encode. Read it first.
- `.agent_sources/`: the source of Effect and effect-machine at the versions this repo pins. `pnpm agent-sources` clones it, and reruns update it after a pin changes. Read it instead of guessing an API from memory or newer docs.

## Commands

- `pnpm check`: format check, build, typecheck, lint, the file-role pass, the deterministic fixtures, the vendored anti-slop rule tests and the env schema test, then knip, the ratchet, `lint:inputs`, `lint:paths`, sherif, gitleaks, `lint:env` and `lint:scripts`, through Turbo with a content-keyed cache. `pnpm check:affected` is `pnpm check --affected`: the same tasks, limited to those whose inputs changed on this branch. `lint:scripts` (`src/fence/check-scripts.cli.mjs`, `check-scripts`, also in akter and akter-cloud) fails when `check:affected` would run a different task list from `check`.
- `pnpm knip`: unused files, exports and dependencies. Every exception sits in `knip.config.ts` with its reason. `pnpm sherif`: package.json consistency. It skips `root-package-dependencies` because this repo is one package whose root is the package consumers link, so its runtime dependencies belong in `dependencies`. `pnpm gitleaks`: secrets in the whole git history, through the gitleaks that `mise.toml` pins (`mise install`). Turbo keys it on the tracked files, so a history-only change is caught by the pre-commit hook, which scans every staged change.
- `.env.schema`: every environment variable the scripts read, in varlock's format. None of rules' own scripts reads one today; akter and akter-cloud `@import` this file. `pnpm lint:env` (`rules-env`) fails when code reads a variable the schema, or a schema it imports, does not declare, or reads `process.env` by a computed name.
- `pnpm fmt`: format with oxfmt. It skips `fixtures/`, `src/oxlint/anti-slop/` and `tests/oxlint/anti-slop/`, which must stay byte-for-byte as measured or vendored.
- Git hooks (lefthook, installed by `pnpm install`): pre-commit formats staged files, scans them for secrets with gitleaks, then builds, typechecks and lints. Hooks never run tests (`../akter/docs/adr/0013-git-hooks-never-run-tests.md`).
- `pnpm lint:structure`: the deterministic `structure` rules over every file in the repo (ADR 0006).
- `src/fence/git-fence.cli.mjs` (`git-fence`): the policy Claude Code, Cursor and Pi run before each shell command (`.claude/settings.json`, `.cursor/hooks.json`, `.pi/extensions/`). It refuses `--no-verify`, `git commit -n`, `core.hooksPath` changes, `LEFTHOOK=0` and its relatives, `lefthook uninstall` and writes into `.git/hooks`. What it covers and what it cannot close is in `docs/git-fence.md`.
- `src/ratchet/ratchet.cli.mjs` (`ratchet`, `pnpm ratchet` here and in akter and akter-cloud): counts knip exceptions, Oxlint rules turned off, override scopes and ignore patterns, inline suppressions and patched dependencies, merges measured counts from the JSON files named by `--counts`, and fails when any count differs from `ratchets.json` (`docs/ratchet.md`).
- `src/turbo/task-inputs.cli.mjs` (`task-inputs`, `pnpm lint:inputs` here and in akter and akter-cloud): runs `turbo run --dry=json` for every `typecheck`, `lint`, `test` and `test:*` task and fails when one doesn't hash a tracked file under its package's `src/` or `tests/`, because turbo would then replay a cached pass after that file changed. Start a package's inputs with `$TURBO_DEFAULT$` or `$TURBO_EXTENDS$`, or list `src/**` and `tests/**`. It also fails a task that doesn't hash a package its package links from outside the repo, and any input outside the repo that hashes no file: turbo 2.11 drops every outside input from a root (`//#`) task, so the consumers hash `../rules` and `../akter` in a package task, `sibling-inputs`, that their root tasks depend on. Write outside inputs as `**` globs or exact files: through a symlinked sibling, turbo matches a `name.*` glob to nothing. It also fails an outside input on a task with a script, or on any task in a package where a task with a script declares outputs: turbo hashes such a task by walking its package's whole folder, `dist` and `node_modules` included, and a build deleting files there during the walk fails the hash with "Package traversal error" (DAL-392). The consumers keep each outside input on a scriptless task in `tools/rules` (`rules-tsconfig`, `lint-plugins` and the like) that the tasks reading it depend on.
- `src/docs/doc-paths.cli.mjs` (`doc-paths`, `pnpm lint:paths` here and in akter and akter-cloud): fails when a repo-relative path written in backticks in a tracked Markdown file doesn't exist, naming the doc and line. A path counts when it starts with `./` or `../`, or when its first folder exists beside the doc or at the repo root. Fenced code, URLs, placeholders such as `<app>/src/app.layer.ts`, a package's own export subpaths, generated folders (`.git`, `.turbo`, `dist`, `node_modules`), paths that leave the repo and folders passed with `--ignore` are skipped.
- `src/mutants/mutants.cli.mjs` (`mutants`, run by `pnpm mutants` and `pnpm mutants:diff` in akter and akter-cloud after `mutant-cafe --advisory`): reads `mutants.out/outcomes.json` in the package and fails on a failed baseline, on any missed, untested, timed-out or unreliable mutant that `mutants.equivalent.json` doesn't list, on an equivalent entry with no reason, and on an entry in either list the run now kills (or, with `--all`, no longer generates). A survivor listed in `mutants.baseline.json` passes; `--write-baseline` writes that file from the last run. Each failure prints a ready entry to fill in (`docs/mutants.md`).
- `src/agent-sources/agent-sources.cli.mjs` (`agent-sources`, `pnpm agent-sources` here and in akter and akter-cloud): shallow-clones each entry in `agent-sources.json` into the gitignored `.agent_sources/<name>`, at the tag of the version `pnpm-workspace.yaml`'s catalog or `package.json` pins (`<package>@<version>`, then `v<version>`, then `<version>`), or at the entry's `ref` for a vendored preview. It reclones only when the pin or ref changes. It needs the network, so `pnpm check` doesn't run it.
- Consumers (`../akter`, `../akter-cloud`) read `dist`, so the pre-commit build keeps it current.

## Do not

- Do not skip hooks with `--no-verify`.
- Do not add a rule about one product's design. It belongs in that product's `tools/rules`.
- Do not add a file whose name does not end in its role, `<kebab-name>.<role>.<ext>` (ADR 0006). The role list lives in `src/oxlint/structure/roles.pure.ts`. The `build` role and Foldkit's `command`, `message`, `model`, `subscription` and `update` roles and Alchemy Domain's twelve roles are opt-in through `structure/file-role`'s `roles` option, not enabled here.
- Do not turn a rule off anywhere but the off table in `src/oxlint/base.config.ts`, and never without a reason (ADR 0002).
- Do not read an environment variable `.env.schema` does not declare, or read one by a computed name. When Effect code first reads one, it reads it through Effect `Config` under the schema's name, with `Config.redacted` for a sensitive one.
- Do not add a knip exception without its reason in `knip.config.ts`; delete the dead code instead when you can.
- Do not raise a number in `ratchets.json` without saying why in the same commit, and do not leave it above the real count.
- Do not list deprecated Effect diagnostics (`preferSchemaOverJson`, `effectGenUsesAdapter`) in `tsconfig.base.json`. The warning fails every consumer's typecheck (ADR 0004).
- Do not edit `src/oxlint/anti-slop` or `tests/oxlint/anti-slop` by hand. Re-vendor a newer upstream commit instead, placing each file where `src/oxlint/anti-slop/UPSTREAM.md` maps it (ADR 0003).
- Do not write a file over 500 lines, Markdown included.
- Do not drop a vendor SDK from `src/oxlint/structure/vendor-sdks.pure.ts` while its service has a Distilled SDK or Alchemy provider (Dallen, 2026-11-07).
- Do not push, publish or add a git remote. Everything stays local for now.
- Do not report a score you did not measure.

## Landing

- Do not open pull requests or keep a long-lived branch. Work lands on `main`.
- Do not fast-forward `main` until the branch is rebased onto it, `pnpm check` exits 0 at the rebased head in this repo and in `../akter` and `../akter-cloud` (they read `../rules/dist`, so run `pnpm build` here first), and any required review is clean.
- Do not build features on `main`. Use a short branch in a worktree, rebase it onto `main` and `git merge --ff-only` it.
- Do not move this checkout's `main` or rebuild its `dist` outside `checkout-lock write . -- <command>`. The `pnpm check` of `../akter` and `../akter-cloud` holds `checkout-lock read ../rules`, so the fast-forward and `pnpm build` after it wait for running checks, and a check never lints against half-moved rules. Run both in one `checkout-lock write . -- sh -c '<fast-forward> && pnpm build'`.
- Do not land with `--no-verify`. Commit through the hooks.
- There is no remote yet. Once one exists, push `main` after each landing, still with no pull requests.

## Layout

- `src/oxlint/base.config.ts`: the Oxlint base config, the off table and the `structure` config. `src/oxlint/effect-call-syntax.pure.ts`: AST helpers both plugins share, imported as `#oxlint/...`.
- `src/oxlint/taste/`: the taste plugin, one `.rule.ts` per rule. `src/oxlint/testing/`: the testing plugin, whose `no-fixed-port` fails a test that binds a fixed port, because two runs on one machine collide on it (DAL-400). `src/oxlint/structure/`: the file-role plugin (`file-role`, `role-imports`, `role-exports`), the role table, and `vendor-imports` with its list of banned vendor SDKs (`vendor-sdks.pure.ts`; see `../akter-cloud/docs/sdk-sources.md`), and `barrel-imports`, which rejects a root import of `@effect/platform-node` or `@effect/platform-bun` because each barrel loads every module in the package, its Redis client included, and names the per-module path to import instead (DAL-365). `src/oxlint/anti-slop`: vendored anti-slop, its rules grouped into `rules/types`, `rules/values` and `rules/conventions`, with its tests in the `tests/oxlint/anti-slop/` mirror. Both are exempt from file roles, and `UPSTREAM.md` maps upstream`s paths to these.
- `tsconfig.base.json`: strict TypeScript and every Effect diagnostic at error.
- `src/agent-sources/`, `src/env/`, `src/fence/`, `src/ratchet/`, `src/docs/` and `src/turbo/`: the CLIs listed above, each a `.cli.mjs` with its `.pure.mjs` logic.
- `tests/`: the tests, mirroring `src/`. A suite that drives a CLI is named for that `.cli.mjs`, and `tests/oxlint/base.config.test.mjs` lints the deterministic fixtures under `fixtures/<plugin>/<rule>/`.
