# @repo/rules

hermit-stack's rulebook: an Oxlint base with every category at error and one off table, vendored anti-slop, the `taste`, `testing` and `structure` plugins, a `tsconfig.base.json` with every Effect diagnostic at error, and the scripts `pnpm check` runs at the repo root. It is a copy of `rika-labs/rules`, owned here; [UPSTREAM.md](./UPSTREAM.md) records the commit and every change since.

| Export or bin                         | What it is                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/rules/oxlint`                  | Oxlint base config, the off table and the `structure` config                                                                      |
| `@repo/rules/oxlint/domain`           | `domainStructure`, which enables Alchemy Domain's roles for given files                                                           |
| `@repo/rules/oxlint/role-imports`     | `roleImports`, which builds `structure/role-imports`'s options from the workspace's `package.json` files                          |
| `@repo/rules/oxlint/taste`            | Deterministic taste rules (Oxlint JS plugin)                                                                                      |
| `@repo/rules/oxlint/testing`          | Test rules: `no-fixed-port` fails a test that binds a fixed port (Oxlint JS plugin)                                               |
| `@repo/rules/oxlint/structure`        | File-role rules (Oxlint JS plugin, ADR 0006)                                                                                      |
| `@repo/rules/oxlint/anti-slop`        | Vendored anti-slop core rules                                                                                                     |
| `@repo/rules/oxlint/anti-slop-effect` | Vendored anti-slop Effect rules                                                                                                   |
| `@repo/rules/tsconfig.base.json`      | Strict TypeScript and the Effect diagnostics                                                                                      |
| `@repo/rules/git-fence`               | The agent hook that refuses skipping the git hooks, loaded by the Claude Code and Pi hooks                                        |
| `git-fence` (bin)                     | The same hook as a command                                                                                                        |
| `file-fence` (bin)                    | Refuses a file over 500 lines or an inline rule suppression, on the staged files                                                  |
| `ratchet` (bin)                       | Fails when an exception count leaves its baseline in `ratchets.json`                                                              |
| `task-inputs` (bin)                   | Fails when a typecheck, lint or test task's cache key misses its package's `src/` or `tests/`, or an outside input hashes nothing |
| `doc-paths` (bin)                     | Fails when a Markdown doc names a missing path                                                                                    |
| `rules-env` (bin)                     | Fails on an environment read `.env.schema` does not declare                                                                       |
| `check-scripts` (bin)                 | Fails when `check:affected` runs different tasks from `check`                                                                     |
| `runtime-pins` (bin)                  | Fails when the Node or Bun on `PATH` is not the one `mise.toml` pins                                                              |
| `mutants` (bin)                       | Fails on a mutant no test kills or explains                                                                                       |
| `agent-sources` (bin)                 | Clones dependency source at the pinned versions into `.agent_sources/`                                                            |

The root `oxlint.config.ts`, `oxlint-structure.config.ts`, `tsconfig.base.json`, `knip.config.ts`, `ratchets.json` and `.env.schema` are how hermit-stack uses them, and `AGENTS.md` here describes each check `pnpm check` runs.

The `build` role, FoldKit's `command`, `message`, `model`, `subscription` and `update` roles, and Alchemy Domain's twelve roles are opt-in. The root `oxlint-structure.config.ts` enables FoldKit's for the FoldKit packages and calls `domainStructure` for the Domain ones. [ADR 0006](./docs/adr/0006-every-file-names-its-role.md) defines each role's contents and import edges.

`ratchet` also checks where code lives:

- Every test lives in its package's `tests/`, at the path and name of the one `src/` file it tests: `tests/<p>/<name>.<role>.test.<ts|tsx|mjs>` for `src/<p>/<name>.<role>.<ext>`. A test inside `src/`, or one with no matching `src/` file, fails with the path it should have.
- A test imports the source it tests through the package's `#src/*` import. Test support files (the `fake` and `workload` roles) live in `tests/` at the path and name of the `src/` file they stand in for, imported through `#tests/*`, which nothing under `src/` may import.
- A test that checks one source file in a particular way adds an aspect after the role: `portable`, `browser`, `workerd`, `bundle`, `types`, `live` or `composed`.
- `eval/**`, `fixtures/**`, `dist/` and a package's root `bench/` are data, not tests.
- One `src/` folder holds at most 10 code files of its own. Subfolders don't count toward their parent.
- Existing violations are counted per package and per folder in `ratchets.json`. They can only go down, and a package or folder with no count fails on its first violation.

`file-fence <files>` refuses a text file over 500 lines and a source file that turns a rule off inline (`oxlint-disable`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`). The pre-commit hook runs it on the staged files, and `ratchet` counts both across the whole repo. Lockfiles, patches, `.gen` files, vendored and built code, generated baselines and `package.json` manifests are uncapped.

The language is in [CONTEXT.md](./CONTEXT.md), the decisions in [docs/adr/](./docs/adr/), and the rules for agents in [AGENTS.md](./AGENTS.md).

## Develop

From the repo root:

```sh
mise install
mise exec -- pnpm install
mise exec -- pnpm exec turbo run build test --filter=@repo/rules
```

The root lint configs load `dist`, which `build` writes. Turbo rebuilds it before every `lint` and the file-role pass.

## License

MIT, with the rest of this repo (see the root [LICENSE](../../LICENSE)). `src/oxlint/anti-slop` is MIT, from dmmulroy/anti-slop.
