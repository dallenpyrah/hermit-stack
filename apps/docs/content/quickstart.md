---
title: "Quickstart"
description: "Install the pinned tools, install the workspace and run the one check that says the repo is healthy."
status: built
---

You have forked hermit-stack and cloned it. Three commands take you from a clean checkout to a repo that passes every check. Nothing here needs a cloud account.

## Install the pinned tools

The repo pins Node, pnpm and gitleaks in `mise.toml`, so every machine and every CI run uses the same versions. Install [mise](https://mise.jdx.dev), then trust the repo's config and install what it pins:

```bash
mise trust
mise install
```

Run every later command through `mise exec --`, so the pinned versions are used even when your shell has others on its `PATH`.

## Install the workspace

```bash
mise exec -- pnpm install
```

This installs every package in the workspace and sets up the Git hooks through lefthook. Two settings in `pnpm-workspace.yaml` shape what you see here:

- **Every version lives in the catalog.** A `package.json` writes `catalog:` instead of a version, and `catalogMode: strict` refuses anything else.
- **A release must be a day old.** `minimumReleaseAge` holds back versions published in the last 24 hours, so a compromised release has a day to be noticed before it can install.

## Run the check

```bash
mise exec -- pnpm check
```

This is the definition of done for every change. It runs `turbo boundaries` first, then one Turbo run of every other check: format, typecheck, lint, file roles, tests, build, knip, the ratchet, task inputs, doc paths, sherif, gitleaks, environment reads and the check scripts. The first run takes a few minutes; later runs replay what Turbo has cached and finish in seconds.

<Tip>
On a branch, `mise exec -- pnpm check:affected` runs the same tasks for the packages your branch changed. A check script makes sure the two never run different task lists.
</Tip>

[Scripts and checks](/reference/scripts-and-checks) lists what each task proves and how to run one alone.

## Try one package

Each package can be checked on its own. The ledger context is the worked example in the template:

```bash
mise exec -- pnpm exec turbo run test --filter=@repo/ledger
```

It runs 17 Story tests against an in-memory host, with no network and no database. [Contexts](/concepts/contexts) walks through what those tests prove.

## Run these docs

The site you are reading is `apps/docs`. Start it locally with:

```bash
mise exec -- pnpm --filter @repo/docs run dev
```

The build writes a static site to the app's `out/` folder, including a Markdown twin of every page and the `llms.txt` files. [Writing these docs](/reference/writing-docs) explains how a page is added and checked.

## What to read next

- [Why hermit-stack](/why-hermit-stack): the principles, and the check that holds each one.
- [Repository layout](/repository-layout): where code lives and which way dependencies point.
- [Add a context](/guides/add-a-context): your first piece of product code.
