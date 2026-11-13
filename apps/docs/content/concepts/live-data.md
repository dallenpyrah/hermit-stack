---
title: "Live data"
description: "Server render on first load, then live updates to every open screen that shows the same data."
status: planned
---

A page in hermitstack arrives complete: the server renders it with real data, and the browser then keeps it current as the data changes, in every tab and on every device that has it open. The two halves share one value, a cursor, so nothing is missed and nothing arrives twice.

## The design

```text
Sketch of the planned flow:

 browser ── GET /accounts/42 ──▶ render handler            (FoldKit server render)
                                 1 read the session cookie
                                 2 client.Balance.snapshot(key) ─▶ { state, cursor }
                                 3 init(flags) ─▶ render to HTML + flags + build id
         ◀── complete HTML ──────┘
 hydrate   the same Model the server rendered
 watch     Balance.watch({ key, after: cursor }) ══ WebSocket ══▶ Api ─▶ host
                                                                    ▲
 another tab, the desktop app, a phone ── DepositMoney ─────────────┘
                                           commit ─▶ pushed to every open watch
```

- **Snapshot**: one read of a view that returns its state and the cursor of the last event folded into it.
- **Flags**: FoldKit's name for the data an app starts with. The server writes them into the HTML.
- **Build id**: written into both bundles, so hydration refuses a page rendered by another deployment.
- **Watch**: a FoldKit Subscription that sends history after the cursor, a `CaughtUp` frame, then each commit as it happens. A reconnect resumes from the last cursor.

## Rules that come with it

- **Anything a screen shows comes from a view.** A view has `snapshot` and `watch`; a query answers once and can go stale.
- **The document never renders a loading state.** `Loading` exists only for navigation the user started.
- **One origin.** The document, the Api and live reads share one origin, because live reads authenticate by cookie.
- **No second cache.** FoldKit's Model is the cache. A view never refetches, because `watch` pushes. A query keeps its state as `AsyncData` in the Model, with `foldkit/experimental/query` for keyed entries. This is why hermitstack does not use TanStack Query: it would put a cache outside the Model, where neither a test nor the server render can see it.
- **Tabs each hold a socket.** A `BroadcastChannel` carries only what the server cannot send, such as "this tab logged out".

A small `packages/client-data/**` package is planned for the read policy of queries: revalidate on focus and on reconnect, prefetch, a stale-time check and a cap on kept entries.

## What exists to build from

- The ledger's `Balance` view already has the shape this needs: a fold over the account's events, kept apart from the aggregate's state.
- `LedgerApi` already exposes `Balance`, and the typed client already reads it at a receipt with `atLeast`, which is how a read waits for a write.
- FoldKit's server render module and Alchemy Domain's `snapshot` and `watch` exist upstream. FoldKit marks its server module experimental.

## What will prove it works

- A render test builds a `Request` with a session cookie and renders the document in process; the HTML contains the data and no loading text.
- A story test hydrates from the server's flags and receives a commit made by a second client.
- A screenshot with scripts off matches the settled page.

## The catches

- Updates are per view. Two views on one screen are not guaranteed to move together.
- Server rendering adds a server to the web app: a Worker on Cloudflare, a Node process beside the Api elsewhere.
- A view that is expensive to snapshot slows the first byte. Each route's list of snapshots is its budget.
