---
title: "Layers and ports"
description: "Everything is an Effect Layer, and every vendor sits behind a port a fork can swap."
status: built
---

A Layer is Effect's unit of dependency injection: it builds a service, and a program that needs the service says so in its type. hermit-stack uses Layers for every choice that might change: the host that runs your aggregates, the vendor that sends email, the backend that stores traces. Swapping one is a different Layer in one place, and the code that uses the service does not change.

## Three kinds of seam

| Seam                | Declared as                                            | Implemented by                                                 | On `main`                                              |
| ------------------- | ------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------ |
| **Host**            | Alchemy Domain's `Platform`                            | `InMemory` today; Rivet and Cloudflare Durable Objects planned | `services/api/src/host.layer.ts`                       |
| **External system** | `ExternalSystem` in a `.external.ts` file in a context | A Layer in an adapter package, and a fake in `tests/`          | `contexts/outbound/src/notification/email.external.ts` |
| **Middleware**      | An `RpcMiddleware` in a `.middleware.ts` file          | A server Layer that reads the request                          | Planned, for [Auth](/guides/auth)                      |

A **port** is the domain's own description of what it needs from the outside, in its own words and with nothing about a vendor. An **adapter** is one package that implements a port for one vendor. Adapters are the only packages allowed to import a vendor SDK.

## The host is one Layer

`services/api/src/host.layer.ts` is the one place a host is chosen. It reads `APP_TARGET` through Effect `Config` and provides the ledger model with the platform for that target:

```text
APP_TARGET ──▶ platforms[target] ──▶ Ledger.layer(...) provided with it ──▶ host
               local: InMemory        the model never names a host
```

Today `local` is the only target. Adding Cloudflare is one more literal in `AppTarget` and one more entry in `platforms`; the model, the Api and every surface stay as they are.

You can build the same composition yourself. The ledger's typed client, running in process over the in-memory host, is one line of Layers:

```ts
import { InMemory } from "@alchemy.run/domain";
import { Layer } from "effect";

import { LedgerApi } from "@repo/ledger/api";
import { Ledger } from "@repo/ledger/model";

// The model has no policies or projections yet, so its Layer needs no handlers.
const hosted = Layer.provide(Ledger.layer(Layer.empty), InMemory);

const localLedger = LedgerApi.layerClientInProcess.pipe(Layer.provide(hosted));
```

Replace `InMemory` with another platform Layer and `localLedger` is the same client on another host. That is the claim the [conformance suite](/guides/testing#conformance-suites) exists to test.

## A port in a context

The outbound context sends email, but it does not know who sends it. It declares the calls it makes in `email.external.ts`, with arguments, a result and a typed failure:

```text
Email.send({ to, subject, text, idempotencyKey })
  ──▶ { messageId }
  ──▶ fails with Undeliverable { reason }
```

The idempotency key is `<eventId>:<userId>:email`, so a notification that is dispatched twice sends one email with any vendor that honours the key.

Tests provide the fake from `tests/notification/email.fake.ts`, which the package exports as `@repo/outbound/email-fake` so another package's tests can use it too:

```ts
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { Email } from "@repo/outbound/email";
import { EmailFake } from "@repo/outbound/email-fake";

const welcome = Effect.gen(function* welcome() {
  const email = yield* Email;

  return yield* email.send({
    idempotencyKey: "evt-1:user-1:email",
    subject: "Welcome",
    text: "Your account is open.",
    to: "sam@example.com",
  });
});

// A test provides the fake once, at its entry point. It honours idempotency keys as a real vendor should.
it.layer(EmailFake)("the email fake", (it) => {
  it.effect("answers a repeated key with the first message id and sends nothing", () =>
    Effect.gen(function* repeatedKey() {
      const first = yield* welcome;
      const second = yield* welcome;

      expect(second).toStrictEqual(first);
    }),
  );
});
```

A real vendor (Resend is the planned first one) will be an adapter package that provides the same `Email` service. [Swap an adapter](/guides/swap-an-adapter) covers the steps.

## Fakes and in-memory Layers are different things

- A **fake** stands in for an outside system in tests. It lives in `tests/`, at the path and name of the `src/` file it replaces: `src/notification/email.external.ts` has `tests/notification/email.fake.ts`.
- An **in-memory Layer** that a running target uses, such as an in-memory host, is product code. It lives in `src/` as a `.layer.ts` file.

## Why it holds

A context cannot import a host, an adapter or a service; Turbo `boundaries` refuses it. So nothing in a context can come to depend on the host or the vendor by accident, and the only code that changes in a swap is the Layer that is provided.

## The catch

Switching code is cheap; switching data is not. A new email vendor is one adapter. A new auth provider is two files, but existing users and their sessions must be migrated. A new telemetry backend loses its history. Dashboards and alarms are written per backend and do not move with the Layer.

## How to check it

- `mise exec -- pnpm boundaries` fails when a context imports a service, an adapter or an app.
- `mise exec -- pnpm exec turbo run test --filter=@repo/spec` runs the conformance suite through the host Layer, in process and over HTTP.
