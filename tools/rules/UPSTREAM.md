# Upstream

Copied from `rika-labs/rules` at commit `9587666c37c88e3c1825cf0786a2f05cc0988686` (2026-11-13), not imported. This repo owns the copy.

Changes made on copy:

- The package is `@repo/rules`, so every `@rikalabs/rules` specifier in `src/` and `tests/` became `@repo/rules`.
- Versions come from the catalog in the root `pnpm-workspace.yaml`.
- The repo-level files (`mise.toml`, `lefthook.yml`, `.oxfmtrc.json`, `pnpm-workspace.yaml`, the root `turbo.json`) live at the repo root.
- `patches/mutant-cafe@0.1.6.patch` moved to the root `patches/`.
- `domainStructure` takes an optional `exports` map and passes it to `structure/role-imports`, so a Domain file can import a workspace package by its role file.
- `domainStructure` lets a `.schema` file import a `.id` file. With one class per file, an aggregate's state lives in a `.schema` file so each command file can read it, and that state names ids.

Changes made while wiring `pnpm check` (the root `package.json`, `turbo.json` and the files below run the checks upstream's own `check` ran):

- `knip.config.ts`, `ratchets.json` and `agent-sources.json` moved to the repo root. `knip.config.ts` is a workspace config: the fixture and vendored-export exceptions apply to `tools/rules`, it hides unused `#tests/*` subpaths in `package.json` files and, until each entry has a consumer, unused catalog entries, and it drops upstream's Amp plugin entry. `ratchets.json` holds this repo's counts.
- Upstream's agent hook configs for Claude Code, Cursor and Pi, and its Amp plugin, were not kept: hermit-stack ships no agent config folders. `src/fence/git-fence.cli.mjs` and its policy stay, and `tests/fence/git-fence.cli.test.mjs` tests the policy and the three answer forms, not any wiring.
- The suites that check the repo's own wiring read it at the repo root, two folders up: `AGENTS.md`, `.gitignore` and `agent-sources.json` (`tests/agent-sources/agent-sources.cli.test.mjs`), the root `package.json` scripts (`tests/fence/check-scripts.cli.test.mjs`, `tests/ratchet/ratchet.cli.test.mjs`), and the ratchet run against the root `ratchets.json`.
- `src/fence/file-fence.pure.mjs` leaves `src/oxlint/anti-slop/` and `tests/oxlint/anti-slop/` uncapped under any folder, not only at the repo root, so the vendored files under `tools/rules/` stay uncapped.
- Turbo 2.11.11, the catalog's version, hashes no file through a symlinked folder, where 2.11.10 still matched `**` globs. `src/turbo/task-inputs.cli.mjs` says so in its message, and `tests/turbo/task-inputs.cli.test.mjs` expects a `**` glob through a symlinked sibling to fail.
- `turbo` is a devDependency, because `tests/turbo/task-inputs.cli.test.mjs` runs this package's `node_modules/.bin/turbo`.
- `turbo.json` lists the packages only `fixtures/` imports under `boundaries.implicitDependencies`, so `turbo boundaries` checks this package. Its `test` task depends on `build` and the root `runtime-pins`, as upstream's did, and hashes the root files the suites read.
- `checkout-lock` (its `.cli.mjs` and `.pure.mjs` in `src/fence/`, its test and bin, and its two variables in `.env.schema`) was removed. It held a sibling checkout still while another repo's check read it, and hermit-stack has no sibling checkouts. Its test races on sub-second timeouts and failed two of four `pnpm check` runs here while the machine was loaded.
- `AGENTS.md`, `README.md`, `CONTEXT.md`, `docs/git-fence.md`, `docs/mutants.md` and `docs/ratchet.md` describe this repo instead of upstream and its sibling repos. The ADRs are unchanged.
- `structure/no-comments` (`src/oxlint/structure/no-comments.rule.ts`, with fixtures in `fixtures/structure/no-comments/`) is new here: it reports every comment in a TypeScript or JavaScript file except a `#!` line, a `/// <reference ... />` line, the `// SAFETY: <reason>` line `anti-slop/require-safety-comment-for-type-assertion` requires, and a `/** @stability stable|unstable|experimental */` tag alone on its line, which the Effect `apiStabilityLeak` diagnostic reads. To pass it, the comments in the copied `src/` and `tests/` files were deleted. It runs in the `lint:structure` pass, which reads every file in the repo, so it also covers the root config files and this package's `.mjs` scripts. The vendored anti-slop files keep their comments: the root `oxlint-structure.config.ts` ignores them.
- `docs/mutants.md` names the packages that run mutation testing and has a section on how a package adopts it; `AGENTS.md` says where it runs.

To take a later upstream change, diff upstream from the commit above to its new head and apply the diff here, then update the commit in this file.
