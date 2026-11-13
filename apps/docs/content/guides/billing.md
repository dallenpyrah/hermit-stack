---
title: "Billing"
description: "Plans, checkout and entitlements behind a port, with the payment vendor in an adapter."
status: planned
---

Billing runs both ways. Outbound, the product asks a payment vendor to start a checkout. Inbound, the vendor reports hours later that a payment settled. In hermitstack both go through one adapter, and what a customer may use is the state of an aggregate, not a call to the vendor.

## The design

```text
Sketch of the planned flow:

outbound   policy ──▶ payments.external.ts ──▶ adapters/stripe ──▶ Stripe
inbound    Stripe ──▶ webhook ──▶ adapters/stripe ──▶ a command in the billing context
```

- **A `billing` context** owns a `Subscription` aggregate. Its state is the entitlement: the plan, its limits and whether it is active. It has events, a view and Story tests like everything else.
- **The app gates features on that aggregate** and never calls the vendor on a request path.
- **A `payments` port** declares the calls the context makes: start a checkout, open the billing portal.
- **The Stripe adapter** implements the port and turns the vendor's webhooks into commands. Products, prices and meters are Alchemy resources in the stack.
- **Swapping the processor** means a new adapter that sends the same commands.

## What will prove it works

- Story tests for each subscription transition: started, renewed, past due, cancelled.
- A contract suite for the payments port against a fake and against the vendor's test mode.
- An inbound webhook delivered twice changes the subscription once.

## The catches

- **Who is the record of truth** for entitlements, the vendor or the aggregate, is hard to change later. The design says the aggregate.
- **Live subscriptions stay with a vendor** until migrated, whatever the code says.
- Alchemy's Stripe example runs on a Cloudflare Worker only; other hosts are not checked.
- A paid feature is not a [feature flag](/guides/feature-flags). It is this aggregate's state.
