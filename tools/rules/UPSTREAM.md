# Upstream

Copied from `rika-labs/rules` at commit `9587666c37c88e3c1825cf0786a2f05cc0988686` (2026-11-13), not imported. This repo owns the copy.

Changes made on copy:

- The package is `@repo/rules`, so every `@rikalabs/rules` specifier in `src/` and `tests/` became `@repo/rules`.
- Versions come from the catalog in the root `pnpm-workspace.yaml`.
- The repo-level files (`mise.toml`, `lefthook.yml`, `.oxfmtrc.json`, `pnpm-workspace.yaml`, the root `turbo.json`) live at the repo root.
- `patches/mutant-cafe@0.1.6.patch` moved to the root `patches/`.
- `domainStructure` takes an optional `exports` map and passes it to `structure/role-imports`, so a Domain file can import a workspace package by its role file.

To take a later upstream change, diff upstream from the commit above to its new head and apply the diff here, then update the commit in this file.
