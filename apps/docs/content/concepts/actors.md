---
title: "Actors"
description: "Each aggregate runs as an actor on a host: Rivet Actors by default, Cloudflare Durable Objects as an alternative."
status: planned
---

An actor is a single-threaded unit that owns its state and handles one message at a time. In hermitstack every aggregate instance (one account, one schedule, one webhook delivery) runs as one actor. The host is the runtime that runs those actors, and it is a Layer, so the same model runs on any of them.

## What is decided

| Host                       | Runs on                                                                    | Live reads | Target                   |
| -------------------------- | -------------------------------------------------------------------------- | ---------- | ------------------------ |
| In-memory                  | Tests and local development                                                | In process | `local`, on `main` today |
| Rivet Actors               | GCP, AWS, Docker, Fly, Hetzner, Kubernetes, Railway, Rivet Cloud           | WebSocket  | `gcp`, `aws`             |
| Cloudflare Durable Objects | Cloudflare                                                                 | WebSocket  | `cloudflare`             |
| Effect Cluster             | AWS, Cloudflare, Docker, Fly, GCP, Hetzner, Kubernetes, backed by Postgres | WebSocket  | Documented, not shipped  |

Rivet is the default host for the containers on GCP and AWS; Durable Objects are the host on Cloudflare. Effect Cluster is documented as a third host for a project that wants its state in Postgres instead of an actor host.

## How it fits

The host is chosen in exactly one place, `services/api/src/host.layer.ts`, from the `APP_TARGET` value. Today its table has one entry, `local: InMemory`. Each planned host is one more entry:

```text
Sketch, not code on main:

const platforms = {
  local:      InMemory,
  cloudflare: DomainCloudflare.layerDurableObjects(),
  gcp:        DomainRivet.layerDurableObjects({ name, main, pool }),
  aws:        DomainRivet.layerDurableObjects({ name, main, pool }),
}
```

The model, the Api and every surface do not change. A context cannot import a host package, so nothing in a context can come to depend on one.

## Lifecycles are machines

A lifecycle with more than a few states (an order, a subscription, an onboarding) is a state machine written with `@typeonce/effect-machine`, and a machine runs only inside an actor. The copied rules already enforce the file side of this: a `.machine.ts` file is allowed only beside an `.actor.ts` file (rules ADR 0007).

## What will prove it works

- **The conformance suite passes on every host.** `@repo/conformance` holds eight ledger guarantees written against the typed client. Today `spec` runs them on the local target. Each host joins as one more `it.layer(...)` line that provides the client from that host. If a host is a true swap, the same suite passes unchanged.
- **A live integration test per target** deploys a stage, drives it through the Api and destroys it.

## The catches

- Rivet and Cloudflare both push live reads over WebSocket, but they bill, scale and fail differently. The conformance suite proves behaviour, not cost.
- Data stays where it was written. Moving a running product between hosts is a data migration, not a Layer change.
- Nothing in this page has run on a real host or clock yet.
