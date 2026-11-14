---
title: "CLI"
description: "A command line client derived from the same Api as every other surface."
status: planned
---

The CLI will be `apps/cli/**`: the Api as a command line, derived with Alchemy Domain's `toCli`. It is a client, not a server. It calls the same typed client over HTTP that the spec uses, so a command behaves the same from a terminal as from the browser.

## The design

```text
Sketch, not code on main:

$ hermit-stack ledger open-account acc-1 --owner sam
$ hermit-stack ledger deposit-money acc-1 --amount 5000
{ "balance": 5000 }
$ hermit-stack ledger withdraw-money acc-1 --amount 9000
InsufficientFunds: balance 5000, requested 9000
```

- **Commands come from the Api.** Each exposed command is a subcommand; its input schema becomes the flags, and its `description` becomes the help text. A renamed command renames the subcommand.
- **An expose list**, like HTTP and MCP, so nothing reaches the command line by accident.
- **Typed rejections stay typed.** `InsufficientFunds` prints its fields and exits non-zero.
- **Live reads are left out.** A CLI call returns once, so views are read with `get`, not watched.

## What exists to build from

- `LedgerApi` with descriptions on every command, view and rejection.
- The typed client over HTTP, already exercised against a live server in `spec` and `services/api/tests`.

## What will prove it works

- A test drives the CLI against a server on a free port and checks the output and exit code for a success and a rejection.
- Renaming a command in the Api fails the CLI's tests, not just its help text.

## The catches

- No example in the Alchemy repo uses `toCli` yet; it is covered by Alchemy's integration tests and docs only.
- Authentication for scripts needs a token flow, which waits on [Auth](/guides/auth).
