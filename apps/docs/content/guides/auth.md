---
title: "Auth"
description: "Sign-in and sessions behind a port, with the identity provider chosen per target."
status: planned
---

The domain says what a request must carry (a signed-in user) and nothing about who checks it. A middleware port declares the requirement; one adapter supplies it. Because HTTP, MCP and the CLI all call the same typed client, one middleware signs in a browser, an agent and a script.

## The design

```text
Sketch of the planned files:

packages/kernel/src/current-user.context.ts   the user behind a request
packages/kernel/src/session.middleware.ts      provides CurrentUser, or fails with Unauthorized
contexts/<name>/src/.../<verb>.command.ts      lists  middleware: [Session]
adapters/better-auth/**                        reads the session from the request; the only vendor code
```

1. The domain declares `CurrentUser`: the user behind a request.
2. The domain declares the `Session` middleware that provides it, or fails with `Unauthorized`. No vendor is named.
3. A command that needs a user lists `middleware: [Session]`.
4. An adapter wraps the identity provider as a service. better-auth, through `@alchemy.run/better-auth`, is the planned first adapter.
5. The seam is one small Layer that reads the session from the request headers and provides `CurrentUser`. Replacing the provider means replacing steps 4 and 5.

## What will prove it works

- A Story test: a command with `Session` and no session is refused with `Unauthorized`, and records nothing.
- A conformance guarantee: "a call without a session is refused", run through every surface.
- The context's code does not change when the adapter does.

## The catches

- **Switching providers is a data migration.** User ids, their shape and who assigns them are hard to change later.
- **better-auth needs a SQL database,** so the database becomes a swappable part too.
- **Some of the sign-in flow is vendor-shaped:** the sign-in routes and provider callbacks belong to the provider.
- **Native apps use a bearer token, not a cookie,** on the same middleware. Whether the adapter gives that directly is not checked.
