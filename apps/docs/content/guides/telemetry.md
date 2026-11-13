---
title: "Telemetry"
description: "Traces, metrics and logs from Effect, exported to whichever backend a target picks."
status: planned
---

Telemetry in hermitstack is a required Layer: a host that is not given one does not typecheck. Spans come from Effect itself, and the backend they go to is one Layer per target.

## What is on `main` today

One piece: the span naming rule. `spanName` in `packages/kernel/src/telemetry/span-name.pure.ts` names every span `<context>.<operation>` in kebab case, so a query finds a context's spans on any backend:

```ts
import { spanName } from "@repo/kernel/span-name";

// "ledger.open-account", whatever case the code names the operation in.
const opening = spanName("ledger", "OpenAccount");

// The pipeable form fixes the operation first.
const closing = spanName("CloseAccount")("ledger");
```

## The design

- **One Layer.** Telemetry is a service the host requires, so leaving it out is a type error.
- **Spans come from Effect.** Commands, handlers and adapters are named with `Effect.fn` and `withSpan`, using names from `spanName`. Alchemy Domain adds a span for each command, event, policy, view and saga, plus `domain.*` metrics and a correlation id.
- **The browser relays.** FoldKit sends its traces to the app's own origin, and the server forwards them, so one trace covers a click to the actor and no ingest token ships to the browser.
- **The backend is a choice.** Axiom, any OTLP backend, or Cloudflare's own telemetry, each one Layer.
- **Telemetry infrastructure is in the stack.** Datasets and scoped ingest tokens are Alchemy resources.

```text
Sketch, not code on main:

services/api/src/observability.layer.ts
  observability = Layer per target:
    local      → console exporter
    cloudflare → Axiom.Telemetry or OTLP
    gcp, aws   → Axiom.Telemetry or OTLP
```

## What will prove it works

- A Story test asserts the spans one command produces, by name.
- Removing the telemetry Layer from a target fails the typecheck.
- A browser trace and its server spans share one trace id in a live integration test.

## The catches

- **Alarms and dashboards do not switch.** Traces and logs follow the Layer; monitors are written per backend. Keying them to the `domain.*` metric names keeps a rewrite small.
- **Cloudflare's own telemetry is the weakest choice.** It starts a new trace per Worker and Durable Object event and cannot take browser spans.
- **A new backend loses history.**
