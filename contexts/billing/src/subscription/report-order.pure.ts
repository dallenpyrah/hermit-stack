import { DateTime, Function as Fn, Match, Option } from "effect";

import type { Mark, SubscriptionState } from "#src/subscription/subscription-state.schema.js";

// The processor's clock counts whole seconds, and a final failed payment and the cancellation it causes can share one.
// Within a second the more final report wins, so the two land as cancelled in either order.
const precedence = { cancelled: 3, paymentFailed: 2, renewed: 1, started: 0 } as const;

const lastMark = (state: SubscriptionState): Option.Option<Mark> =>
  Match.valueTags(state, {
    Active: (active) => Option.some(active.last),
    Cancelled: (cancelled) => Option.some(cancelled.last),
    NoSubscription: () => Option.none(),
    PastDue: (pastDue) => Option.some(pastDue.last),
  });

const after = (next: Mark, last: Mark): boolean =>
  DateTime.isGreaterThan(next.at, last.at) ||
  (DateTime.Equivalence(next.at, last.at) && next.precedence > last.precedence);

const isNewerArity = 2;

// A report no newer than the last one applied is a repeat or arrived late, so it changes nothing.
const isNewer: {
  (next: Mark): (state: SubscriptionState) => boolean;
  (state: SubscriptionState, next: Mark): boolean;
} = Fn.dual(isNewerArity, (state: SubscriptionState, next: Mark): boolean =>
  Option.match(lastMark(state), { onNone: () => true, onSome: (last) => after(next, last) }),
);

const recordArity = 3;

// Processor reports are facts that already happened, so they are never refused: one that is not newer records nothing.
const recordIfNewer: {
  <Event>(next: Mark, event: () => Event): (state: SubscriptionState) => readonly Event[];
  <Event>(state: SubscriptionState, next: Mark, event: () => Event): readonly Event[];
} = Fn.dual(recordArity, <Event>(state: SubscriptionState, next: Mark, event: () => Event): readonly Event[] => {
  if (!isNewer(state, next)) {
    return [];
  }

  return [event()];
});

export { precedence, recordIfNewer };
