import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Queue, Stream } from "effect";
import { TestClock } from "effect/testing";

import { revalidateOnFocus, revalidateOnReconnect } from "#src/revalidate/revalidate.subscription.js";

// Node has no page, so each case stands in a bare event target for the one global the Subscription listens to.
class FakeDocument extends globalThis.EventTarget {
  public visibilityState: DocumentVisibilityState = "hidden";
}

const ignoredAt = 7000;

const sentAt = 9000;

const nothingSent = 0;

// Lets the forked Subscription attach its listener, or handle an event already dispatched, before the case goes on.
const settle = Effect.repeat(Effect.yieldNow, { times: 10 });

const listening = (stream: Stream.Stream<number>): Effect.Effect<Queue.Queue<number>> =>
  Effect.gen(function* listen() {
    const sent = yield* Queue.unbounded<number>();

    yield* Effect.forkChild(Stream.runForEach(stream, (now) => Queue.offer(sent, now)));
    yield* settle;

    return sent;
  });

const dispatchedAt = (target: EventTarget, type: string, now: number): Effect.Effect<void> =>
  Effect.gen(function* dispatch() {
    yield* TestClock.setTime(now);
    target.dispatchEvent(new globalThis.Event(type));
    yield* settle;
  });

const unstub = Effect.sync(() => vi.unstubAllGlobals());

const focusSendsTheTime = Effect.gen(function* focusSendsTheTimeCase() {
  const page = new FakeDocument();

  vi.stubGlobal("document", page);

  const sent = yield* listening(revalidateOnFocus((now) => now).dependenciesToStream({}));

  yield* dispatchedAt(page, "visibilitychange", ignoredAt);

  const whileHidden = yield* Queue.size(sent);

  page.visibilityState = "visible";
  yield* dispatchedAt(page, "visibilitychange", sentAt);

  const onVisible = yield* Queue.take(sent);

  expect([whileHidden, onVisible]).toStrictEqual([nothingSent, sentAt]);
}).pipe(Effect.ensuring(unstub));

const reconnectSendsTheTime = Effect.gen(function* reconnectSendsTheTimeCase() {
  const browser = new globalThis.EventTarget();

  vi.stubGlobal("window", browser);

  const sent = yield* listening(revalidateOnReconnect((now) => now).dependenciesToStream({}));

  yield* dispatchedAt(browser, "offline", ignoredAt);

  const whileOffline = yield* Queue.size(sent);

  yield* dispatchedAt(browser, "online", sentAt);

  const onOnline = yield* Queue.take(sent);

  expect([whileOffline, onOnline]).toStrictEqual([nothingSent, sentAt]);
}).pipe(Effect.ensuring(unstub));

describe("revalidation Subscriptions", () => {
  it.effect(
    "send the time when the page becomes visible again, and nothing when it is hidden",
    () => focusSendsTheTime,
  );
  it.effect(
    "send the time when the browser comes back online, and nothing when it goes offline",
    () => reconnectSendsTheTime,
  );
});
