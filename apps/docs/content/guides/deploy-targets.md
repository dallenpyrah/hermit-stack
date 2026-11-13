---
title: "Deploy targets"
description: "A target is a named composition of Layers, picked by one config value: local today, then Cloudflare, GCP and AWS."
status: planned
---

A target is a host, a cloud and the adapters for it, given a name. Choosing where hermitstack runs is choosing a name in one config value, `APP_TARGET`. Infrastructure is Effect code too: Alchemy stacks describe what each target deploys.

## What is on `main` today

`services/api/src/host.layer.ts` reads `APP_TARGET` with `Config.Literals(["local"], "APP_TARGET")` and provides the model with the platform for that name. `local` runs on the in-memory host, and `spec` runs the conformance suite against it. There is no process entry and no deploy yet.

## The four targets

| Target       | Host            | Cloud               | Live reads |
| ------------ | --------------- | ------------------- | ---------- |
| `local`      | In-memory       | Your machine, tests | In process |
| `cloudflare` | Durable Objects | Cloudflare          | WebSocket  |
| `gcp`        | Rivet Actors    | Google Cloud        | WebSocket  |
| `aws`        | Rivet Actors    | AWS                 | WebSocket  |

Effect Cluster, backed by Postgres, is documented as a fifth option and not shipped.

## The design

```text
Sketch of the planned layout:

services/api/src/targets/<target>/   the two or three files that differ per target
infra/src/app.stack.ts               the application, per target
infra/src/ci.stack.ts                CI identity and credentials, as code
alchemy.run.ts                       reads APP_TARGET and picks the target
```

- **One config value.** `APP_TARGET` picks the host Layer, the telemetry Layer and the adapters together.
- **A stage per pull request.** Each pull request deploys its own stage, runs live tests against it and destroys it on close.
- **CI credentials are a stack.** No one pastes keys into a settings page.
- **Delete to choose.** The template carries every target, each tested in the template's own CI. A fork deletes the target folders it does not want, and knip and the catalog prune what that leaves unused. What a fork keeps is code that was already tested together.

## What will prove it works

- The conformance suite passes against every target, unchanged.
- A live integration test per target deploys a stage, drives it through the Api and destroys it.
- A CI job deletes each target folder in turn and reruns `pnpm check`, proving no other code depended on it.

## The catches

- A target that has never been deployed is a claim, not a fact. Nothing here has been deployed yet.
- GCP credentials for CI are not covered by Alchemy's CI guide.
- Moving a running product between targets moves its data too.
