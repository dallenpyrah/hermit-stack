---
title: "Web"
description: "The FoldKit web app: rendered on the server from a view's snapshot, then kept live over a WebSocket."
status: built
---

The web app is `apps/web`, a FoldKit application with one page, `/accounts/<id>`, that shows an account's owner, balance and status and can deposit and withdraw. The server renders the page from the `Balance` view's snapshot, so the first HTML already holds the balance and there is no loading state. The browser hydrates from the same Model, then follows the account's events over a WebSocket from the snapshot's cursor, so a deposit made anywhere appears on every open page once.

## Run it

```bash
cd apps/web
mise exec -- pnpm dev
```

The dev server listens on port 4310 and opens a demo account with $120.00 at `/accounts/demo`. Add `?theme=dark` for the dark theme. The ledger runs in memory, so a restart starts it again from the demo account.

A deposit from outside the page, which every open page shows:

```bash
curl -X POST http://localhost:4310/rpc -H 'content-type: application/ndjson' --data-binary $'{"_tag":"Request","id":"1","tag":"DepositMoney","payload":{"target":"demo","input":{"amount":1000}},"headers":[]}\n'
```

The body must end with a newline: the RPC endpoint reads newline-delimited JSON.

## How a page is served

```text
browser ── GET /accounts/demo ──▶ renderPage (apps/web/src/entry/server.page.ts)
                                  1 client.Balance.snapshot(id) over POST /rpc on the same origin
                                  2 init(flags) and renderToString
          ◀── HTML with the balance and the Flags ──┘
hydrate   makeApplication + hydrate (apps/web/src/entry/browser.main.ts), from the Flags in the page
follow    Balance.events(id, after: cursor) ══ WebSocket GET /rpc ══▶ Api ─▶ host
```

- **Flags**: the JSON the server writes into the page, `{ account: { state, cursor }, accountId, session, theme }`. `account` is the view's snapshot in `ledger.Balance.SnapshotFlags` form. It stays `Unknown` in the Flags Schema and is decoded in `init`, so a page served by an older deployment whose state no longer decodes still boots: empty at cursor 0, and the feed replays the account from its first event.
- **session**: a random id per page load, the prefix of every command id the page sends, so two tabs never share one and a retried send is recognised.
- **The session cookie** is forwarded on the snapshot read. When sign-in lands, the Api's middleware judges the render's read exactly as it judges the browser's live read.
- **Headers**: a page is `cache-control: private, no-store` and `vary: cookie`, because it holds one person's data and a fresh command session.

## How it stays live

The page follows `Balance.events` after its cursor, not `Balance.watch`. `watch` takes no cursor and always starts by resending the current state, which the server just rendered. `Balance` declares no `emit`, so every event it folds arrives as an entry carrying the state after it, and following events misses no change. A view that declares `emit` changes state without an entry; follow it with `watch` instead.

- The feed sends the events committed since the snapshot, then `CaughtUp`, then each new event. The page shows a Live badge after `CaughtUp`.
- A dropped socket reconnects and resumes after the last event it delivered. The page applies an entry only when its cursor is past the one it holds, so a repeated delivery changes nothing.
- The balance comes only from the feed, never from a command's reply. The feed delivers the event the command committed, and applying both would count the movement twice. The reply ends the send, or shows the typed rejection, such as `InsufficientFunds` with the balance and the amount asked for.
- When the feed gives up after its reconnects, the page says updates are paused and offers Reconnect, which restarts the feed from the cursor it holds.
- The page sends one movement at a time; a second click while one is in flight does nothing.

## One origin

The document, the commands and the live reads share one origin, because a browser cannot set headers on a WebSocket and a live read authenticates with the cookies its upgrade carries. In development, `apps/web/src/vite/ledger-api.plugin.ts` mounts the ledger's routes on the Vite server: POST `/rpc` and `/rpc/` (the typed client posts with the trailing slash) go to the Api, and each WebSocket upgrade to `/rpc` is a live read. Vite cannot load a server module until its environments are ready, after `configureServer` returns, so the plugin loads the ledger on the first `listening` event. The server entry does not reload on edit in development; restart the dev server after changing it.

A deployed target serves the same pieces from `services/api`. An app may not depend on a service, so `services/api` loads the web app's build output by path:

- `vite build` writes `apps/web/dist/client/**` (static files) and `apps/web/dist/server/**`, with `fetch.js`, whose default export is `{ fetch }`, a Web fetch handler.
- `services/api` routes `/rpc` for every method, including the GET that upgrades to a WebSocket, to the Api's `fetch`; today it routes only POST.
- It serves the client folder as static files and sends the remaining GET, HEAD and OPTIONS requests to `fetch.js`. The Api's own routes take precedence.
- The page's snapshot read goes to the same origin's `/rpc`, one loopback request per render.

## The tests

- `apps/web/tests/entry/server.page.test.ts` serves the ledger's routes on a port the operating system assigns, renders a page for an account with a known balance and asserts the HTML holds that balance, the Flags and no loading state.
- `apps/web/tests/account/account.subscription.test.ts` runs the page's own subscription and update over real WebSockets: two pages see a third party's deposit once each, and a page whose sockets are dropped misses a deposit, reconnects and catches up with no entry applied twice. It runs on the real clock, because the reconnect backoff would never elapse on a test clock.
- `apps/web/tests/account/account.view.test.ts` and `apps/web/tests/account/account.update.test.ts` are Scene and Story tests of the page's transitions, including the refused overdraft, whose rejection comes from the real ledger in memory.
