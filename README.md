# Strata

A template monorepo to fork for new products: Effect v4 on the frontend, backend, infrastructure and tests, with Alchemy Domain for the model, FoldKit for the web app, StyleX for styling and Oxlint for the rules.

"Strata" is a working name.

## Start

```sh
mise install
mise exec -- pnpm install
mise exec -- pnpm check
```

`pnpm check` is the one command that says whether the repo is sound. [AGENTS.md](./AGENTS.md) lists the layout, the dependency rules and the conventions the checks enforce.

## What always stays, and what swaps

Effect, FoldKit, Alchemy, Oxlint and StyleX stay. Everything else is a Layer supplied at the edge: the actor host (in-memory, Rivet, Cloudflare Durable Objects), the cloud (GCP, AWS, Cloudflare), the telemetry backend, and each vendor (auth, billing, storage, mail).
