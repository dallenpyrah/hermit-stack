---
title: "Notifications, webhooks and schedules"
description: "Outbound messages, outbound webhooks and scheduled work, modelled as aggregates and policies with every vendor behind a port."
status: built
---

Three things every product ends up needing: telling a person something happened, telling another system something happened, and doing work at a time rather than on a request. In hermit-stack all three are ordinary domain code (aggregates, commands and policies) with every vendor behind a port. Two packages hold them:

- `contexts/outbound` (`@repo/outbound`): public events, notifications and outbound webhooks, in one model.
- `packages/schedule` (`@repo/schedule`): the `Recurring` aggregate and its `Rearm` policy.

<Note>
The models, their Story tests and the vendor adapters are on `main`. Nothing here has run on a real host or a real clock yet, and no adapter has called its real vendor: each is proved against a local stand-in. The last section lists what is still to come.
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

## Vendor adapters

Each port has one contract suite, written against the port alone, in `contexts/outbound/tests`: `email.suite.ts` and `push.suite.ts` under `notification/`, and `webhook-transport.suite.ts` under `webhook/`. The in-memory fakes beside them pass it, and so does every adapter, against a local stand-in for its vendor on a port the operating system assigns. The stand-in answers the way the vendor's documentation says the vendor does, so it proves the adapter against that reading of the vendor, not against the vendor itself.

| Package                 | Port               | Vendor call                                                                    | Repeat of one idempotency key                                                                                    |
| ----------------------- | ------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `adapters/resend`       | `Email`            | `POST /emails` with a Bearer key                                               | Resend's `Idempotency-Key` header, as the SHA-256 of a key over 256 characters                                   |
| `adapters/apns`         | `Push`             | `POST /3/device/<token>` over HTTP/2, ES256 provider token                     | none at Apple; the key's hash is the `apns-collapse-id`, so the device shows one notification, and the `apns-id` |
| `adapters/fcm`          | `Push`             | `messages:send`, after an RS256 service-account assertion buys an access token | none at Google; the key's hash is the Android notification tag and the APNs collapse id                          |
| `adapters/webhook-http` | `WebhookTransport` | a signed `POST` to the endpoint                                                | `webhook-id` is the event id, for the receiver to drop repeats                                                   |

A few choices worth knowing:

- Only a refusal that will never succeed is a typed failure: Resend's 422 naming the `to` field is `Undeliverable`, APNs's 410 and FCM's `UNREGISTERED` are `DeviceGone`. APNs's 400 `BadDeviceToken` is not, because a token sent to the wrong environment gets it too. A timeout, a rate limit or a 5xx fails as a defect, so the dispatch runs again later.
- The webhook transport signs as Standard Webhooks specifies and never follows a redirect. Its host provides `SigningSecrets`, one `whsec_` secret per endpoint, because events are kept for good and the secret must not travel with one.
- The transport refuses loopback, private, link-local, unique-local, shared and multicast addresses inside undici's connector, after the name is resolved and right before the dial, so a name that changes what it resolves to cannot slip past. That connector reads a `Network` service: the real Layer uses the system resolver and undici's own dialler; the tests use one where names resolve from a fixed table and every dial reaches the local receiver. The guard runs unchanged in both, and one test shows the real Layer refusing the local receiver by address, by `localhost` and by an IPv4-mapped IPv6 address, while a plain client reaches it.
- APNs speaks only HTTP/2. The adapter offers h2 through ALPN over https and uses undici's `H2CClient` over plain http, which only the stand-in serves; the stand-in is an HTTP/2-only server, so a request sent as HTTP/1.1 gets no answer.
- The stand-ins sign and check with keys generated for each run. No key is committed.

The stand-ins follow these pages:

- Resend: `api-reference/introduction`, `api-reference/emails/send-email`, `dashboard/emails/idempotency-keys` and `api-reference/errors` under https://resend.com/docs. The exact message for a malformed `to` comes from https://github.com/resend/resend-node/issues/286, because the docs list the error but not its text.
- APNs: `sending-notification-requests-to-apns`, `establishing-a-token-based-connection-to-apns`, `handling-notification-responses-from-apns` and `generating-a-remote-notification` under https://developer.apple.com/documentation/usernotifications.
- FCM: https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send, https://firebase.google.com/docs/cloud-messaging/send/v1-api, https://firebase.google.com/docs/cloud-messaging/error-codes and https://firebase.google.com/docs/cloud-messaging/manage-tokens; the token endpoint follows https://developers.google.com/identity/protocols/oauth2/service-account, with RFC 6749 section 5.2 for the status of a refused grant.
- Standard Webhooks: https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md, and RFC 9110 for both forms of `Retry-After`.

## Scheduled work

`packages/schedule` treats time as a source of commands. A `Recurring` aggregate holds a cron expression, a time zone and the next due time:

- `Arm` starts or restarts a schedule. It is sent at every startup, and arming again replaces the pending tick.
- `Tick` is one occurrence, a command the aggregate schedules to itself. `packages/schedule/src/recurring/tick/` holds `tick.command.ts`, the `Ticked` event and the `Rearm` policy, which schedules the next tick through the Domain client with `{ at, commandId: "tick:<name>" }`, so a schedule never has two ticks waiting.
- `Pause` stops the chain until the next `Arm`.

A repeated tick does nothing. A late tick runs once and the next one is due after now, so missed occurrences are not replayed.

```ts
import { Arm } from "@repo/schedule/arm";
import { Recurring } from "@repo/schedule/recurring";

const nightly = Arm.make({ cron: "0 3 * * *", timeZone: "Europe/Paris" });

const digest = Recurring.ref("nightly-digest");
```

The input schemas check the cron expression and the IANA time zone where they enter, so `Arm` never refuses one. Your own work hangs off `Ticked`: a policy in your context that reacts to the tick of the schedule it owns.

## Still planned

- Quiet hours, digests and email suppression for notifications.
- An Api for the outbound context, so clients can read the inbox and manage endpoints.
- Wiring the adapters into a deploy target in `services/api`, and a run against each real vendor.
- Inbound webhooks as a general pattern: verify, deduplicate, turn into a command.
- Running any of this on a real host and clock.

## How to check it

```bash
mise exec -- pnpm exec turbo run test --filter=@repo/outbound --filter=@repo/schedule --filter=@repo/resend --filter=@repo/apns --filter=@repo/fcm --filter=@repo/webhook-http
```

Schedule has 5 Story tests on Effect's test clock: ticks and re-arms, a repeated tick, a late tick, pause and re-arm, and a cron expression it cannot read. Outbound has 3 Stories: a public event reaches a user's inbox and sends one email, a delivery is retried until it succeeds, and a delivery stops after the eighth attempt. Its contract suites run 5 Email, 5 Push and 8 WebhookTransport cases against the fakes, and the same cases against Resend (5), APNs (5), FCM (5) and the HTTP webhook transport (8, plus its loopback refusal).
