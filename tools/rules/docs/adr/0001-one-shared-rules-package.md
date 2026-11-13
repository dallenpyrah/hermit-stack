---
status: accepted
date: 2026-11-06
---

# One shared rules package; product rules stay in product repos

`@rikalabs/rules` holds every rule that is not about one product: the Oxlint base and its off table, vendored anti-slop, the `taste` plugin, and `tsconfig.base.json` with the Effect diagnostics. Rules about one product's design, such as Akter's `contract-imports`, live in that product's repo under `tools/rules`. Consumers link this repo by path while everything is local.

## Consequences

- A change here reruns lint, and typecheck for `tsconfig.base.json`, in every consumer, so it ships as one change checked against them.
