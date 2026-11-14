import { layerTest } from "@effect/platform-node/NodeHttpServer";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Context, DateTime, Effect, Layer, Match, Redacted, Ref, Schema } from "effect";
import type { Scope } from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { Hex } from "effect/encoding";
import { HttpClient, HttpClientRequest, HttpRouter } from "effect/http";

import { Subscription } from "@repo/billing/subscription";

import { StripeWebhook } from "#src/stripe-webhook.adapter.js";
import {
  billingHost,
  commands,
  customer,
  deleted,
  failed,
  firstPaymentFailed,
  prices,
  renewed,
  started,
  unknownType,
} from "#tests/stripe-webhook.suite";
import type { EventFixture } from "#tests/stripe-webhook.suite";

interface Signed {
  readonly body: string;
  readonly signature: string;
}

interface Standing {
  readonly periodEnd?: string;
  readonly plan?: string;
  readonly status: string;
}

type SubscriptionClient = Context.Service.Identifier<typeof Subscription>;

interface Sent {
  readonly _tag: string;
}

interface Signing {
  readonly secondsAgo: number;
  readonly secret: string;
}

const secret = "stand-in-signing-secret";

const millisPerSecond = 1000;

const okStatus = 200;

const badRequestStatus = 400;

const noCommits = 0;

const oneCommit = 1;

const tenMinutes = 600;

const rightNow: Signing = { secondsAgo: 0, secret };

const path = "/webhooks/stripe";

const webCrypto = Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto));

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

const bytesOf = (text: string): Effect.Effect<Uint8Array, Schema.SchemaError> =>
  Schema.decodeEffect(Schema.Uint8ArrayFromHex)(Hex.encode(text));

const sign = Effect.fn("sign")(function* sign(event: EventFixture, signer: Signing) {
  const mac = yield* Mac.Mac;
  const secretBytes = yield* bytesOf(signer.secret);
  const key = yield* Mac.key(Mac.hmacSha256, secretBytes);
  const body = yield* encodeJson(event);
  const timestamp = Math.floor(DateTime.toEpochMillis(DateTime.nowUnsafe()) / millisPerSecond) - signer.secondsAgo;
  const signed = yield* bytesOf(`${timestamp}.${body}`);
  const digest = yield* mac.sign(key, signed);

  return { body, signature: `t=${timestamp},v1=${Hex.encode(digest)}` };
}, Effect.orDie);

const serve = (webhook: StripeWebhook["Service"]): Effect.Effect<HttpClient.HttpClient, never, Scope.Scope> => {
  const route = HttpRouter.add("POST", path, webhook.handle);

  const served = HttpRouter.serve(route, { disableListenLog: true, disableLogger: true }).pipe(
    Layer.provideMerge(layerTest),
  );

  return Effect.map(Effect.orDie(Layer.build(served)), Context.get(HttpClient.HttpClient));
};

const post = (client: HttpClient.HttpClient, signed: Signed): Effect.Effect<number> => {
  const request = HttpClientRequest.post(path).pipe(
    HttpClientRequest.bodyText(signed.body, "application/json"),
    HttpClientRequest.setHeader("stripe-signature", signed.signature),
  );

  return Effect.map(Effect.orDie(client.execute(request)), (response) => response.status);
};

const standingOf = (state: Effect.Success<ReturnType<Subscription["Service"]["get"]>>): Standing =>
  Match.valueTags(state, {
    Active: (active) => ({ periodEnd: DateTime.formatIso(active.periodEnd), plan: active.plan, status: "Active" }),
    Cancelled: () => ({ status: "Cancelled" }),
    NoSubscription: () => ({ status: "NoSubscription" }),
    PastDue: (pastDue) => ({ periodEnd: DateTime.formatIso(pastDue.periodEnd), plan: pastDue.plan, status: "PastDue" }),
  });

const noting = (sent: Ref.Ref<readonly Sent[]>): Layer.Layer<SubscriptionClient, never, SubscriptionClient> =>
  Layer.effect(
    Subscription,
    Effect.gen(function* notingSends() {
      const subscriptions = yield* Subscription;

      return {
        ...subscriptions,
        send: (target, command, options) =>
          Effect.andThen(Ref.update(sent, Arr.append(command)), subscriptions.send(target, command, options)),
      };
    }),
  );

const host = Effect.gen(function* host() {
  const billing = billingHost();

  const sent = yield* Ref.make<readonly Sent[]>([]);

  const webhook = StripeWebhook.layer({ prices, secret: Redacted.make(secret) }).pipe(Layer.provide(noting(sent)));

  const built = yield* Layer.build(Layer.provideMerge(webhook, billing.layer));

  const client = yield* serve(Context.get(built, StripeWebhook));

  const read = Context.get(built, Subscription).get(Subscription.ref(customer).id);

  return {
    commits: billing.commits,
    deliver: (event: EventFixture, signer: Signing = rightNow): Effect.Effect<number, never, Mac.Mac> =>
      Effect.flatMap(sign(event, signer), (signed) => post(client, signed)),
    sent: Ref.get(sent),
    standing: Effect.map(read, standingOf),
    state: read,
  };
});

const deliverInTurn = (
  billing: Effect.Success<typeof host>,
  events: readonly EventFixture[],
): Effect.Effect<void, never, Mac.Mac> => Effect.forEach(events, (event) => billing.deliver(event), { discard: true });

const sendsTheCommandForEach = Effect.gen(function* sendsTheCommandForEach() {
  const billing = yield* host;

  yield* deliverInTurn(billing, [started, renewed, failed, deleted]);

  const sent = yield* billing.sent;

  expect(sent).toStrictEqual([commands.started, commands.renewed, commands.failed, commands.deleted]);
});

const followsEachEvent = Effect.gen(function* followsEachEvent() {
  const billing = yield* host;
  const standings: unknown[] = [];

  for (const event of [started, renewed, failed, deleted]) {
    const status = yield* billing.deliver(event);

    const standing = yield* billing.standing;

    expect(status).toBe(okStatus);
    standings.push(standing);
  }

  expect(standings).toStrictEqual([
    { periodEnd: "2026-02-01T00:00:00.000Z", plan: "pro", status: "Active" },
    { periodEnd: "2026-03-01T00:00:00.000Z", plan: "pro", status: "Active" },
    { periodEnd: "2026-04-01T00:00:00.000Z", plan: "pro", status: "PastDue" },
    { status: "Cancelled" },
  ]);
});

const refusesWrongSignature = Effect.gen(function* refusesWrongSignature() {
  const billing = yield* host;
  const status = yield* billing.deliver(started, { secondsAgo: 0, secret: "someone-elses-secret" });
  const standing = yield* billing.standing;

  expect(status).toBe(badRequestStatus);
  expect(billing.commits()).toBe(noCommits);
  expect(standing).toStrictEqual({ status: "NoSubscription" });
});

const refusesStaleTimestamp = Effect.gen(function* refusesStaleTimestamp() {
  const billing = yield* host;
  const status = yield* billing.deliver(started, { secondsAgo: tenMinutes, secret });

  expect(status).toBe(badRequestStatus);
  expect(billing.commits()).toBe(noCommits);
});

const appliesARepeatOnce = Effect.gen(function* appliesARepeatOnce() {
  const billing = yield* host;
  const first = yield* billing.deliver(renewed);
  const repeat = yield* billing.deliver(renewed);

  expect([first, repeat]).toStrictEqual([okStatus, okStatus]);
  expect(billing.commits()).toBe(oneCommit);
});

const endsTheSameInEitherOrder = Effect.gen(function* endsTheSameInEitherOrder() {
  const inOrder = yield* host;
  const outOfOrder = yield* host;

  yield* deliverInTurn(inOrder, [started, renewed, failed]);
  yield* deliverInTurn(outOfOrder, [failed, started, renewed]);

  const [inOrderState, outOfOrderState, standing] = yield* Effect.all([
    inOrder.state,
    outOfOrder.state,
    outOfOrder.standing,
  ]);

  expect(standing).toStrictEqual({ periodEnd: "2026-04-01T00:00:00.000Z", plan: "pro", status: "PastDue" });
  expect(outOfOrderState).toStrictEqual(inOrderState);
});

const acknowledgesWhatItDoesNotKnow = Effect.gen(function* acknowledgesWhatItDoesNotKnow() {
  const billing = yield* host;
  const statuses = yield* Effect.forEach([unknownType, firstPaymentFailed], (event) => billing.deliver(event));

  expect(statuses).toStrictEqual([okStatus, okStatus]);
  expect(billing.commits()).toBe(noCommits);
});

describe("a stripe webhook delivery", () => {
  it.layer(webCrypto)("signed with the endpoint's secret", (signed) => {
    signed.effect("becomes the billing command for what Stripe reports", () => sendsTheCommandForEach);
    signed.effect("moves the subscription through started, renewed, past due and cancelled", () => followsEachEvent);
    signed.effect("changes the subscription once when Stripe delivers the same event twice", () => appliesARepeatOnce);
    signed.effect("ends in the same state when events arrive in the wrong order", () => endsTheSameInEitherOrder);
    signed.effect(
      "is acknowledged and changes nothing when billing has no command for it",
      () => acknowledgesWhatItDoesNotKnow,
    );
  });

  it.layer(webCrypto)("not signed correctly", (unsigned) => {
    unsigned.effect("is refused with 400 and changes nothing when its signature is wrong", () => refusesWrongSignature);
    unsigned.effect("is refused with 400 when its timestamp is outside the tolerance", () => refusesStaleTimestamp);
  });
});
