# @rikalabs/rules

The shared rulebook for Rika Labs repos: an Oxlint base with every category at error and one off table, vendored anti-slop, the `taste` plugin and a `tsconfig.base.json` with every Effect diagnostic at error.

| Export                                    | What it is                                                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@rikalabs/rules/oxlint`                  | Oxlint base config and the off table                                                                                                                                                                         |
| `@rikalabs/rules/oxlint/taste`            | Deterministic taste rules (Oxlint JS plugin)                                                                                                                                                                 |
| `@rikalabs/rules/oxlint/testing`          | Test rules: `no-fixed-port` fails a test that binds a fixed port (Oxlint JS plugin)                                                                                                                          |
| `@rikalabs/rules/oxlint/structure`        | File-role rules (Oxlint JS plugin, ADR 0006)                                                                                                                                                                 |
| `@rikalabs/rules/oxlint/anti-slop`        | Vendored anti-slop core rules                                                                                                                                                                                |
| `@rikalabs/rules/oxlint/anti-slop-effect` | Vendored anti-slop Effect rules                                                                                                                                                                              |
| `@rikalabs/rules/tsconfig.base.json`      | Strict TypeScript and the Effect diagnostics                                                                                                                                                                 |
| `rules-env` (bin)                         | Fails on an env read `.env.schema` does not declare                                                                                                                                                          |
| `@rikalabs/rules/.env.schema` (file)      | The scripts' env vars, for consumers to `@import`                                                                                                                                                            |
| `git-fence` (bin)                         | Agent hook that refuses skipping the git hooks                                                                                                                                                               |
| `@rikalabs/rules/git-fence`               | The same hook, loaded by path-independent hooks                                                                                                                                                              |
| `ratchet` (bin)                           | Fails when an exception count leaves its baseline                                                                                                                                                            |
| `task-inputs` (bin)                       | Fails when a task's cache key misses src/ or tests/, a package it links from outside the repo, or an outside input, or when an outside input sits on a task turbo must hash by walking a package that builds |
| `doc-paths` (bin)                         | Fails when a Markdown doc names a missing path                                                                                                                                                               |
| `mutants` (bin)                           | Fails on a mutant no test kills or explains                                                                                                                                                                  |
| `agent-sources` (bin)                     | Clones dependency source at the pinned versions                                                                                                                                                              |
| `checkout-lock` (bin)                     | Holds a checkout still while a check reads it                                                                                                                                                                |

`../akter/oxlint.config.ts`, `../akter/oxlint-structure.config.ts` and `../akter/tsconfig.base.json` show a consumer. Product-specific rules live in each product's `tools/rules`.

The `build` role and Foldkit's `command`, `message`, `model`, `subscription` and `update` roles are opt-in. A Foldkit app configures `structure/file-role` with `{ roles: ["command", "message", "model", "subscription", "update"] }` for its modules and adds `"foldkit"` to `structure/role-imports`'s `packages` option. There is no Foldkit preset. Alchemy Domain's twelve roles (`aggregate`, `context`, `event`, `external`, `id`, `middleware`, `policy`, `projection`, `query`, `rejection`, `saga`, `stream`) are opt-in too; `domainStructure({ files })` from `@rikalabs/rules/oxlint/domain` turns them on with Domain's meanings of `command`, `model`, `view` and `api`. [ADR 0006](./docs/adr/0006-every-file-names-its-role.md) defines their contents and import edges.

`checkout-lock read <checkout>...` registers the package script that runs it (its parent process) as a reader of each sibling checkout, waiting first while a landing holds one, and returns. `checkout-lock write <checkout> -- <command>` waits until no live reader is left, holds the checkout while the command runs, and releases it. A check that starts with `checkout-lock read ../akter` therefore sees akter either before a landing or after it, never in between. A waiting landing goes first: once it has asked for the checkout, a check that arrives later waits behind it, so back-to-back checks can't hold a landing off. A check the landing's own command runs reads through the landing's lock. The lock lives in the checkout's git dir (`checkout-lock/`). Each entry records its PID and normalized UTC process start time from `ps`; an exited process or a different start time proves it stale, so reclamation reports the owner and removes the entry. A live PID whose recorded or observed identity is unavailable blocks with `process identity unverifiable`, including ancestor writers. Registration fails when its own start time cannot be read. Either side gives up after `CHECKOUT_LOCK_MINUTES` (30) with a message naming each holder by its `HEAVY_LABEL` or working directory, pid and registration time.

`ratchet` also checks where code lives (Dallen, 2026-11-07, DAL-289 and DAL-290):

- Every test lives in its package's `tests/`, at the path and name of the one `src/` file it tests: `tests/<p>/<name>.<role>.test.<ts|tsx|mjs>` for `src/<p>/<name>.<role>.<ext>`. A test inside `src/`, or one with no matching `src/` file, fails with the path it should have. When one entry point has several suites, each suite is named for the source file that implements its feature. If a file's test passes 500 lines, split the source file, not the test. Runtime variants such as workerd or browser are vitest projects over the same files, so they get no extra name.
- A test imports the source it tests through one alias per package, with no extension in the specifier, so `tests/<path>/<name>.<role>.test.ts` imports `#src/<path>/<name>.<role>`. A package that is never built maps `"#src/*": "./src/*.ts"`, and a built one maps `"#src/*": { "@akterjs/source": "./src/*.ts", "default": "./dist/*.mjs" }`, so the same specifier reaches source in the workspace and the published `dist/` outside it. A relative `../src/` import fails `import/no-relative-parent-imports`. The `structure/file-role` rule rejects a bare `<name>.test.ts` inside `tests/`.
- Tests import fakes and workloads in another folder through a second alias, `"#tests/*": "./tests/*.ts"`, again with no extension in the specifier. Nothing under `src/` may import `#tests/*`, which `structure/role-imports` enforces, so test code never ships.
- A test that checks one source file in a particular way adds an aspect from a fixed list after the role: `tests/<p>/<name>.<role>.<aspect>.test.ts`, where aspect is `portable` (runs in Chromium and workerd), `browser`, `workerd`, `bundle`, `types` (declaration emit), `live` (real external services) or `composed` (the file run against real sibling services as processes). The name still starts with the exact source file it tests.
- Test support files (the `fake` and `workload` roles) live in `tests/` too, at the path and name of the `src/` file they stand in for or drive, with only the role different. A fake that covers several files is named for the entry service it drives.
- `eval/**`, `fixtures/**`, `dist/` and Quint specs are data, not tests.
- A package's root `bench/` is outside the mirror too. It holds benches and the workloads they upload into sandboxes, which run there with no packages, so it has no `src/` file to mirror. A `bench/` folder deeper in a package is in scope. Nothing under `src/` may import from the root `bench/`, which `structure/role-imports` enforces, so bench code never ships.
- One `src/` folder holds at most 10 code files of its own, so a flat folder gets split into subfolders named for nouns of its domain. Subfolders don't count toward their parent, and `tests/` follows `src/`.
- Existing violations are counted per package (`tests outside the mirror in <package>`) and per folder (`code files in <folder> (cap 10)`) in `ratchets.json`. They can only go down, and a package or folder with no count fails on its first violation.

`file-fence <files>` refuses a text file over 500 lines and a source file that turns a rule off inline (`oxlint-disable`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`). Each repo's pre-commit hook runs it on the staged files, so a file meets the cap whenever someone touches it. Lockfiles, patches, `.gen` files, vendored and built code, generated baselines (`openapi.json`, `contracts.json`, mutant lists) and `package.json` manifests are uncapped. `ratchet` counts both across the whole repo (`files over 500 lines`, `inline suppressions`) and names each long file when the count grows.

The language is in [CONTEXT.md](./CONTEXT.md), the decisions in [docs/adr/](./docs/adr/), and the rules for agents in [AGENTS.md](./AGENTS.md).

## Develop

Needs the tool versions `mise.toml` pins, installed and put on `PATH` by [mise](https://mise.jdx.dev) (`mise install`, then `mise activate` in your shell).

```sh
mise install
pnpm install
pnpm check   # build, typecheck, lint and tests
```

Consumers link this repo by path and read `dist`, so rebuild after every change.

## License

Apache-2.0. `src/oxlint/anti-slop` is MIT, from dmmulroy/anti-slop.
