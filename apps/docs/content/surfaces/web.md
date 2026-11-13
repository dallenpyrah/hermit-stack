---
title: "Web"
description: "The FoldKit web app: rendered on the server, then live, styled with the shared design system."
status: planned
---

The web app will be `apps/web/**`, a FoldKit application: model, message, update and view, with every side effect as a Command or a Subscription. It is a client of the Api like every other surface, it renders on the server first and it stays live afterwards.

## The design

```text
Sketch of the planned layout:

apps/web/
  src/<feature>/   *.model.ts *.message.ts *.update.ts *.view.ts *.subscription.ts *.stylex.ts
  src/server/      the render entry, and one function per route listing the snapshots it needs
  tests/           Scene tests, render tests, live-update stories
```

- **The typed client comes from the Api** through Alchemy Domain's FoldKit integration, so a renamed command fails the web app's typecheck.
- **First paint is a server render** from view snapshots, and the browser then watches from the same cursor. [Live data](/concepts/live-data) describes the flow.
- **Styles come from `@repo/ui`**, compiled with `stylexPlugin()` from `@repo/ui/vite`. No Tailwind.
- **The FoldKit roles are already switched on.** `model`, `message`, `update`, `subscription` and `command` are allowed under `apps/web/**` in `oxlint-structure.config.ts`, ahead of the app.
- **Telemetry relays through the server**, so the browser holds no ingest token.

## What exists to build from

- `packages/ui`: tokens, both themes and six components, with Scene tests.
- `LedgerApi` and the `Balance` view, which give a first screen something real to show.

## What will prove it works

- Scene tests for each screen's transitions, with no browser.
- A render test: a request with a session cookie renders complete HTML with no loading text.
- A story where a second client's command updates an open screen.
- The [conformance suite](/guides/testing#conformance-suites) still passes, because the web app adds no behaviour of its own to the Api.

## The catches

- FoldKit's server render module is experimental and can change in a minor release.
- Server rendering adds a server process to the web app on every target.
