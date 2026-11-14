---
title: "Notifications, webhooks and schedules"
description: "Outbound messages, outbound webhooks and scheduled work, modelled as aggregates and policies with every vendor behind a port."
status: built
---

Three things every product ends up needing: telling a person something happened, telling another system something happened, and doing work at a time rather than on a request. In hermit-stack all three are ordinary domain code (aggregates, commands and policies) with every vendor behind a port. Two packages hold them:

- `contexts/outbound` (`@repo/outbound`): public events, notifications and outbound webhooks, in one model.
- `packages/schedule` (`@repo/schedule`): the `Recurring` aggregate and its `Rearm` policy.

<Note>
The models and their Story tests are on `main`. Nothing here has run on a real host or a real clock yet, and the vendor adapters are planned. The last section lists what is still to come.
</Note>

## One feed fans out

Every public event starts in one place, so notifications and webhooks are policies inside one model rather than wiring between two:

```text
Publish ──▶ Feed ── Published ──┬─▶ NotifyAudience ──▶ Notify, per user in the audience ──▶ Recipient
                                │                         NotificationQueued ──▶ DispatchNotification
                                │                         ──▶ Email or Push port ──▶ RecordDelivery
                                │
                                └─▶ StartDeliveries ──▶ StartDelivery, per endpoint ──▶ Delivery
                                                          PostDelivery ──▶ WebhookTransport ──▶ RecordAttempt
                                                          AttemptFailed ──▶ ScheduleRetry ──▶ AttemptDelivery
                                                          Delivered, Exhausted, Abandoned ──▶ TrackEndpointHealth
```

Each arrow into an aggregate is a command, and each command has its own folder beside its aggregate, holding the command, the events it records and the policy that sends it. `contexts/outbound/src/webhook/record-attempt/` is a full example: `record-attempt.command.ts` with its `decideRecordAttempt` rule, its four events (`delivered`, `attempt-failed`, `exhausted`, `abandoned`) and `post-delivery.policy.ts`, which posts the webhook and sends the command with the answer.

## Notifications

`Publish` on the `Feed` aggregate records `Published`. The `NotifyAudience` policy sends `Notify` to the `Recipient` aggregate of each user in the event's audience, which queues the notification and puts it in the user's `Inbox` view. `DispatchNotification` sends each queued notification through the `Email` or `Push` port and records the answer with `RecordDelivery`. Recipients also set their email address, register and remove push devices, set preferences and mark notifications read, each a command in its own folder under `contexts/outbound/src/notification/`.

The email is sent under the idempotency key `<eventId>:<userId>:email`. If the dispatch runs twice, a vendor that honours the key sends one email. The port is declared in `contexts/outbound/src/notification/email.external.ts`, and a Push port sits beside it in `push.external.ts`.

## Outbound webhooks

Endpoints live in one `Endpoints` aggregate per tenant. For each public event, `StartDeliveries` starts one `Delivery` aggregate per active endpoint that takes the event's type. `PostDelivery` posts each attempt through the `WebhookTransport` port and records the answer, and `TrackEndpointHealth` tells the endpoint how each delivery ended, so an endpoint that keeps failing is disabled.

A failed delivery is retried on the schedule Standard Webhooks suggests:

| After attempt | Wait                |
| ------------- | ------------------- |
| 1             | 5 seconds           |
| 2             | 5 minutes           |
| 3             | 30 minutes          |
| 4             | 2 hours             |
| 5             | 5 hours             |
| 6             | 10 hours            |
| 7             | 10 hours            |
| 8             | stop, marked failed |

A longer `Retry-After` from the receiver wins over the table, so a receiver that asks for time gets it. A `410 Gone` marks the delivery abandoned at once. The schedule is a pure function in `contexts/outbound/src/webhook/retry-delay.pure.ts`.

## Scheduled work

`packages/schedule` treats time as a source of commands. A `Recurring` aggregate holds a cron expression, a time zone and the next due time:

- `Arm` starts or restarts a schedule. It is sent at every startup, and arming again replaces the pending tick.
- `Tick` is one occurrence, a command the aggregate schedules to itself. `packages/schedule/src/recurring/tick/` holds `tick.command.ts`, the `Ticked` event and the `Rearm` policy, which schedules the next tick through the Domain client with `{ at, commandId: "tick:<name>" }`, so a schedule never has two ticks waiting.
- `Pause` stops the chain until the next `Arm`.

A repeated tick does nothing. A late tick runs once and the next one is due after now, so missed occurrences are not replayed.

```ts
import { Arm } from "@repo/schedule/arm";
import { Recurring } from "@repo/schedule/recurring";

// The input schemas check the cron expression and the IANA time zone where they enter, so Arm never refuses one.
const nightly = Arm.make({ cron: "0 3 * * *", timeZone: "Europe/Paris" });

const digest = Recurring.ref("nightly-digest");
```

Your own work hangs off `Ticked`: a policy in your context that reacts to the tick of the schedule it owns.

## Still planned

- Quiet hours, digests and email suppression for notifications.
- An Api for the outbound context, so clients can read the inbox and manage endpoints.
- The vendor adapters: Resend for email, APNs and FCM for push, and an HTTP webhook transport that signs requests, checks addresses and enforces timeouts. Each will come with a contract suite that runs against its fake and its real implementation.
- Inbound webhooks as a general pattern: verify, deduplicate, turn into a command.
- Running any of this on a real host and clock.

## How to check it

```bash
mise exec -- pnpm exec turbo run test --filter=@repo/outbound --filter=@repo/schedule
```

Schedule has 5 Story tests on Effect's test clock: ticks and re-arms, a repeated tick, a late tick, pause and re-arm, and a cron expression it cannot read. Outbound has 3: a public event reaches a user's inbox and sends one email, a delivery is retried until it succeeds, and a delivery stops after the eighth attempt.
