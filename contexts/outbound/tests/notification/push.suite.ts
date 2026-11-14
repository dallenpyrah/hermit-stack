import type { Identifier } from "@alchemy.run/domain/ExternalSystem";
import { expect } from "@effect/vitest";
import type { Vitest } from "@effect/vitest";
import { Cause, Effect, Exit, Record as Rec } from "effect";
import { TestClock } from "effect/testing";

import { Push } from "#src/notification/push.external.js";
import { PushVendor } from "#tests/notification/push.fake";

type PushServices = PushVendor | Identifier<typeof Push>;

type Promise = Effect.Effect<void, object, PushServices>;

const content = { body: "Invoice 7 was paid.", title: "Invoice paid" };

const showsTheNotification = Effect.gen(function* showsTheNotificationCase() {
  const push = yield* Push;
  const vendor = yield* PushVendor;
  const token = yield* vendor.register;
  const sent = yield* push.send({ ...content, idempotencyKey: "shows:user-1:push", token });
  const shown = yield* vendor.shownOn(token);

  expect(sent.messageId).not.toBe("");
  expect(shown).toStrictEqual([content]);
});

const repeatedKeyShowsOnce = Effect.gen(function* repeatedKeyShowsOnceCase() {
  const push = yield* Push;
  const vendor = yield* PushVendor;
  const token = yield* vendor.register;
  const first = yield* push.send({ ...content, idempotencyKey: "repeats:user-1:push", token });
  const repeated = yield* push.send({ ...content, idempotencyKey: "repeats:user-1:push", token });
  const shown = yield* vendor.shownOn(token);

  expect(repeated).toStrictEqual(first);
  expect(shown).toStrictEqual([content]);
});

const distinctKeysShowEach = Effect.gen(function* distinctKeysShowEachCase() {
  const push = yield* Push;
  const vendor = yield* PushVendor;
  const token = yield* vendor.register;
  const first = yield* push.send({ ...content, idempotencyKey: "twice-1:user-1:push", token });
  const second = yield* push.send({ ...content, idempotencyKey: "twice-2:user-1:push", token });
  const shown = yield* vendor.shownOn(token);

  expect(second.messageId).not.toBe(first.messageId);
  expect(shown).toStrictEqual([content, content]);
});

const forgottenDeviceGone = Effect.gen(function* forgottenDeviceGoneCase() {
  const push = yield* Push;
  const vendor = yield* PushVendor;
  const token = yield* vendor.register;

  yield* vendor.forget(token);

  const refused = yield* Effect.flip(push.send({ ...content, idempotencyKey: "gone:user-1:push", token }));

  expect(refused).toHaveProperty("_tag", "DeviceGone");
});

const timeoutNotGone = Effect.gen(function* timeoutNotGoneCase() {
  const push = yield* Push;
  const vendor = yield* PushVendor;
  const token = yield* vendor.register;

  yield* vendor.stopAnsweringFor(token);

  const exit = yield* Effect.exit(push.send({ ...content, idempotencyKey: "silent:user-1:push", token }));

  expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
  expect(Exit.isFailure(exit) && Cause.hasFails(exit.cause)).toBe(false);
});

const promises = {
  "a repeated idempotency key shows the device one notification and answers with the first message id":
    repeatedKeyShowsOnce,
  "a send shows the title and body on the device and answers with a message id": showsTheNotification,
  "a send the vendor never answers fails as a defect, not as DeviceGone": timeoutNotGone,
  "a send to a device the vendor has forgotten is DeviceGone": forgottenDeviceGone,
  "sends with different idempotency keys each show, with different message ids": distinctKeysShowEach,
} satisfies Readonly<Record<string, Promise>>;

const onLiveClock = (promise: Promise): Promise => TestClock.withLive(promise);

const pushContract = (onImplementation: Vitest.MethodsNonLive<PushServices>): void => {
  for (const [title, promise] of Rec.toEntries(promises)) {
    onImplementation.effect(title, () => onLiveClock(promise));
  }
};

export { pushContract };
