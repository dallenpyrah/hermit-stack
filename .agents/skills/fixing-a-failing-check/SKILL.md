---
name: fixing-a-failing-check
description: Diagnoses and fixes a failing pnpm check task in hermit-stack, such as ratchet, knip, boundaries, lint:structure, lint:paths, lint:inputs, lint:env, sherif, gitleaks, flags:check, a commit hook or an install refused by the release-age policy. Use when pnpm check, CI or a commit fails, or when tempted to turn a rule off. Not for a failing test of product behavior, which is an ordinary bug.
---

# Fixing a failing check

`mise exec -- pnpm check` exiting 0 is the definition of done. Fix what the check found. The check is changed only when it is wrong, in its one home, with the reason written down.

## Find the task

`pnpm check` is one Turbo run, so the error is not at the end of the output. Write the output to a file. Turbo lists the failed tasks under `Failed:` in its closing lines, as `<package>#<task>`:

```bash
mise exec -- pnpm check > /tmp/check.log 2>&1; echo "exit=$?"
rg -n -A6 "Failed:" /tmp/check.log
```

Then run that task alone until it passes: `mise exec -- pnpm exec turbo run <task> --filter=@repo/<package>` for a package task, `mise exec -- pnpm <task>` for a root one. `tools/rules/AGENTS.md` says what each task checks.

## What each failure asks for

- **`ratchet`: a count differs from `ratchets.json`.** Run `mise exec -- pnpm exec ratchet --print`. A count that fell: lower the number. A count that rose, or "has no baseline": first try to remove the exception. If it is needed, set the number to the printed count and give the reason in the commit message. After a merge conflict in `ratchets.json`, keep both sides' lines and set the numbers from `--print`.
- **`typecheck`: `unstableApiUsage`.** Add the module to `allowedUnstableApis` in that package's `tsconfig.json`, then update the ratchet.
- **`typecheck`: `apiStabilityLeak`.** An export exposes an unstable Effect type. Put `/** @stability unstable */` alone on the line above the export.
- **`lint:structure`: `file-role`.** Name the file `<kebab-name>.<role>.ts`. The roles are in `tools/rules/src/oxlint/structure/roles.pure.ts`. Domain and FoldKit roles are on only for the folders `oxlint-structure.config.ts` lists.
- **`lint:structure`: `role-imports`.** The file's role may not import that. Move the code to a file whose role may; do not rename the file to a looser role.
- **`lint:structure`: `no-comments`.** Delete the comment. Put what it said into a name, a type or a test, and a design reason into the docs page that covers it.
- **`lint:structure`: more than 10 code files in a folder.** Split the folder by use case.
- **`lint`: a rule you think is wrong here.** There are no inline suppressions. A rule is turned off only in the off table in `tools/rules/src/oxlint/base.config.ts`, or narrowed by an override in `oxlint.config.ts`, with its reason in `apps/docs/content/reference/lint-rules.md`. Both raise a ratchet count. Rewrite the code first.
- **`boundaries`.** A package imports against the direction in the root `AGENTS.md`, or imports a workspace package its `package.json` does not list. Move the code, or declare a port and implement it in an adapter.
- **`knip`.** Delete the unused file, export, dependency or catalog entry. Add an exception to `knip.config.ts` only for something a tool loads without an import, with its reason.
- **`lint:paths`.** A path in backticks in a Markdown file does not exist. Fix the path. For a folder that is planned, write a glob such as `apps/web/**` or a placeholder such as `contexts/<name>/`.
- **`lint:inputs`.** A package's `turbo.json` overrides `inputs` without starting them with `$TURBO_EXTENDS$`, so Turbo would replay a stale pass.
- **`lint:env`.** Code reads an environment variable by a name `.env.schema` does not declare. Declare it there and read it through Effect `Config`.
- **`sherif`.** Two `package.json` files disagree, or one breaks a workspace rule. The message names the rule and the file. A dependency version belongs in the catalog in `pnpm-workspace.yaml`, written as `catalog:` in the package.
- **`flags:check`.** A flag is past its `removeBy` or `reviewBy` date. Load the `adding-a-feature-flag` skill and remove or review it.
- **`fmt:check`.** Run `mise exec -- pnpm fmt`.
- **`pnpm install` refuses a version.** It is less than a day old (`minimumReleaseAge`). Pin the newest version that is old enough.

## Never

- Never commit with `--no-verify`, set `LEFTHOOK=0` or change `core.hooksPath`.
- Never delete or skip a test, loosen an assertion or raise a ratchet number to get a pass.
- Never weaken `minimumReleaseAge`, `trustPolicy` or the catalog's strict mode.

## Gotchas

- Lint loads the built rules from `tools/rules/dist/`. After changing a rule, run `mise exec -- pnpm exec turbo run build --filter=@repo/rules` first.
- Root Oxlint cannot lint the whole repo in one call, because the type-aware rules need a package's `tsconfig.json`. Lint per package through Turbo.
- Turbo replays a cached pass. To prove a fix, run the task with `--force` once.
- The commit hook typechecks and lints but never runs tests. A commit that the hook accepts can still fail `pnpm check`.

## Done

`mise exec -- pnpm check` exits 0, and the report names any ratchet number, off-table entry or knip exception that changed, with its reason.
