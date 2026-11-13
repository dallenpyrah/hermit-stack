---
title: "Swap an adapter"
description: "Replace a vendor by writing a new Layer for the same port, and prove it with the port's contract suite."
status: planned
---

Every vendor in hermitstack sits behind a port the domain declares. Swapping a vendor means writing one adapter package that implements the same port, running the port's contract suite against it, and providing it where the target is composed. No context changes.

## What is on `main` today

The ports exist; the adapters do not yet.

| Port               | Declared in                                                   | Fake                                                 | Planned adapters                                             |
| ------------------ | ------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| `Email`            | `contexts/outbound/src/notification/email.external.ts`        | `contexts/outbound/tests/notification/email.fake.ts` | Resend                                                       |
| `Push`             | `contexts/outbound/src/notification/push.external.ts`         | none yet                                             | APNs, FCM                                                    |
| `WebhookTransport` | `contexts/outbound/src/webhook/webhook-transport.external.ts` | none yet                                             | An HTTP transport that signs, checks addresses and times out |

## The steps, once adapters exist

1. **Create the package** under `adapters/<vendor>/`, tagged `adapter`. It may import the context whose port it implements and `@repo/kernel`, and nothing else from the workspace.
2. **Import the vendor SDK only here.** The `vendor-imports` lint rule fails if the SDK is imported anywhere outside `adapters/**`.
3. **Implement the port as a Layer**, translating the vendor's errors into the port's typed failures. For email that means a hard bounce becomes `Undeliverable`, and a timeout stays a failure the caller may retry.
4. **Run the contract suite.** Each port gets one suite, written once, that runs against the fake and against every adapter. A new adapter passes the same cases the fake does.
5. **Provide it in the target.** The target's composition in `services/api` swaps the old Layer for the new one.
6. **Delete the old adapter** if nothing else uses it. knip and the catalog then flag its dependencies as unused.

```text
Sketch, not code on main:

adapters/resend/src/email.adapter.ts
  ResendEmail = Email.toLayer(Effect.gen(function* () {
    const client = yield* ResendClient
    return { send: (args) => client.emails.send(...).pipe(Effect.mapError(toUndeliverable)) }
  }))
```

## What will prove it works

- The port's contract suite passes against the fake and the new adapter, with the same case titles.
- `pnpm boundaries` passes, which means no context reached into the adapter.
- The Story tests of the context do not change, because they never saw the vendor.

## The catches

- Switching code is cheap; switching data is not. Moving email vendors keeps no history of what was sent; moving payment vendors leaves live subscriptions with the old one until they are migrated.
- A contract suite against a real vendor needs credentials and a sandbox account, so it runs on a schedule, not in every `pnpm check`.
