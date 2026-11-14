import type { Identifier } from "@alchemy.run/domain/ExternalSystem";
import { expect } from "@effect/vitest";
import type { Vitest } from "@effect/vitest";
import { Cause, Effect, Exit, Record as Rec } from "effect";
import { TestClock } from "effect/testing";

import { Email } from "#src/notification/email.external.js";
import { EmailVendor } from "#tests/notification/email.fake";

type EmailServices = EmailVendor | Identifier<typeof Email>;

// A case fails with what the port can fail with, or with the answer to a send that should have been refused.
type Promise = Effect.Effect<void, object, EmailServices>;

const content = { subject: "Invoice paid", text: "Invoice 7 was paid." };

// The cases share one build of the implementation, so each sends to its own address with its own keys.
const sendsTheEmail = Effect.gen(function* sendsTheEmailCase() {
  const email = yield* Email;
  const vendor = yield* EmailVendor;
  const to = "sends@hermit-stack.dev";
  const sent = yield* email.send({ ...content, idempotencyKey: "sends:user-1:email", to });
  const delivered = yield* vendor.deliveredTo(to);

  expect(sent.messageId).not.toBe("");
  expect(delivered).toStrictEqual([content]);
});

const repeatedKeySendsOnce = Effect.gen(function* repeatedKeySendsOnceCase() {
  const email = yield* Email;
  const vendor = yield* EmailVendor;
  const to = "repeats@hermit-stack.dev";
  const first = yield* email.send({ ...content, idempotencyKey: "repeats:user-1:email", to });
  const repeated = yield* email.send({ ...content, idempotencyKey: "repeats:user-1:email", to });
  const delivered = yield* vendor.deliveredTo(to);

  expect(repeated).toStrictEqual(first);
  expect(delivered).toStrictEqual([content]);
});

const distinctKeysSendEach = Effect.gen(function* distinctKeysSendEachCase() {
  const email = yield* Email;
  const vendor = yield* EmailVendor;
  const to = "twice@hermit-stack.dev";
  const first = yield* email.send({ ...content, idempotencyKey: "twice-1:user-1:email", to });
  const second = yield* email.send({ ...content, idempotencyKey: "twice-2:user-1:email", to });
  const delivered = yield* vendor.deliveredTo(to);

  expect(second.messageId).not.toBe(first.messageId);
  expect(delivered).toStrictEqual([content, content]);
});

const badAddressUndeliverable = Effect.gen(function* badAddressUndeliverableCase() {
  const email = yield* Email;
  const vendor = yield* EmailVendor;
  const to = "sam";
  const refused = yield* Effect.flip(email.send({ ...content, idempotencyKey: "malformed:user-1:email", to }));
  const delivered = yield* vendor.deliveredTo(to);

  expect(refused).toHaveProperty("_tag", "Undeliverable");
  expect(delivered).toStrictEqual([]);
});

const timeoutNotUndeliverable = Effect.gen(function* timeoutNotUndeliverableCase() {
  const email = yield* Email;
  const vendor = yield* EmailVendor;
  const to = "silent@hermit-stack.dev";

  yield* vendor.stopAnsweringFor(to);

  const exit = yield* Effect.exit(email.send({ ...content, idempotencyKey: "silent:user-1:email", to }));

  // A timeout is worth retrying, so it fails the call as a defect and never as the typed Undeliverable.
  expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
  expect(Exit.isFailure(exit) && Cause.hasFails(exit.cause)).toBe(false);
});

const promises = {
  "a repeated idempotency key sends once and answers with the first message id": repeatedKeySendsOnce,
  "a send delivers the subject and text to the address and answers with a message id": sendsTheEmail,
  "a send the vendor never answers fails as a defect, not as Undeliverable": timeoutNotUndeliverable,
  "a send to a malformed address is Undeliverable and delivers nothing": badAddressUndeliverable,
  "sends with different idempotency keys each deliver, with different message ids": distinctKeysSendEach,
} satisfies Readonly<Record<string, Promise>>;

const onLiveClock = (promise: Promise): Promise => TestClock.withLive(promise);

// One test per promise of the Email port, against whatever provides the port together with a view of the vendor
// Behind it: the in-memory fake, or an adapter wired to a local stand-in for its vendor. Run it with it.layer(implementation)(title, emailContract), so every case
// Shares one build. The cases run on the live clock because an adapter's timeout is real time.
const emailContract = (onImplementation: Vitest.MethodsNonLive<EmailServices>): void => {
  for (const [title, promise] of Rec.toEntries(promises)) {
    onImplementation.effect(title, () => onLiveClock(promise));
  }
};

export { emailContract };
