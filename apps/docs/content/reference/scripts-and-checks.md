---
title: "Scripts and checks"
description: "Every task pnpm check runs, what each one proves and how to run one alone."
status: built
---

`mise exec -- pnpm check` is the definition of done. It runs `turbo boundaries`, then one Turbo run of every other task, so independent tasks run in parallel and unchanged ones replay from the cache. `tools/rules/AGENTS.md` describes each check in full.

## What `pnpm check` runs

| Task             | Proves                                                                                                                      | Run alone                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `boundaries`     | Every import follows the tag rules, and every workspace import is declared                                                  | `pnpm boundaries`                                            |
| `fmt:check`      | Every file is formatted by oxfmt                                                                                            | `pnpm fmt:check`; `pnpm fmt` fixes it                        |
| `typecheck`      | Types and the 145 Effect diagnostics, per package; for these docs, also every `ts` code block                               | `pnpm exec turbo run typecheck`                              |
| `lint`           | Oxlint with type-aware rules, per package                                                                                   | `pnpm exec turbo run lint`                                   |
| `lint:structure` | Every file names its role, and roles appear only where allowed                                                              | `pnpm lint:structure`                                        |
| `test`           | Every package's tests                                                                                                       | `pnpm exec turbo run test --filter=@repo/<name>`             |
| `build`          | Packages with a build produce it: the rules' plugins, the UI gallery, these docs                                            | `pnpm exec turbo run build`                                  |
| `knip`           | No unused file, export, dependency or catalog entry                                                                         | `pnpm knip`                                                  |
| `ratchet`        | Each counted exception matches `ratchets.json` exactly                                                                      | `pnpm ratchet`; `pnpm exec ratchet --print` shows the counts |
| `lint:inputs`    | Every `typecheck`, `lint` and `test` task hashes its package's `src/` and `tests/`, so the cache cannot replay a stale pass | `pnpm lint:inputs`                                           |
| `lint:paths`     | Every path written in backticks in a tracked Markdown file exists                                                           | `pnpm lint:paths`                                            |
| `sherif`         | The `package.json` files agree with each other                                                                              | `pnpm sherif`                                                |
| `gitleaks`       | No secret anywhere in the Git history                                                                                       | `pnpm gitleaks`                                              |
| `lint:env`       | No code reads an environment variable `.env.schema` does not declare                                                        | `pnpm lint:env`                                              |
| `lint:scripts`   | `check:affected` runs the same task list as `check`                                                                         | `pnpm lint:scripts`                                          |

Run each through `mise exec --` so the pinned Node and pnpm are used.

## The ratchet

`ratchets.json` holds a count for each kind of exception: knip exceptions, rules turned off, override scopes, ignore patterns, quieted diagnostics, inline suppressions, files over 500 lines, patched dependencies, trust-policy exceptions, tests outside the mirror and folders over 10 files. The check fails when a real count differs from the file in either direction. A count that goes up needs a reason in the same commit; a count that goes down must be lowered so it cannot creep back. `tools/rules/docs/ratchet.md` has the details.

## Git hooks

`pnpm install` installs lefthook. Before each commit it formats the staged files, checks the line cap and inline suppressions, scans for secrets, checks boundaries, then typechecks, lints and runs the file-role pass. Hooks never run tests. Never skip them with `--no-verify`. `tools/rules` has a policy an agent hook can run to refuse it; no agent config ships in the template, and `tools/rules/docs/git-fence.md` says how to wire one and what it covers.

## CI

`.github/workflows/check.yml` runs `pnpm check` on GitHub Actions: on every pull request, every night with the Turbo cache off, and when started by hand. It does not run on a push to `main`.

## Not in `pnpm check` yet

- **Mutation testing.** The `mutants` gate is copied (`tools/rules/docs/mutants.md`) but no package runs it.
- **A checker time budget** per package, from principle 9 in [Why hermit-stack](/why-hermit-stack).
- **Deleting each target and rerunning the check**, once there is more than one target.
