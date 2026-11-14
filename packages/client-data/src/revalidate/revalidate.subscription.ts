import { Clock, Option, Stream } from "effect";
import { Dom, Subscription } from "foldkit";
import type { Subscription as SubscriptionTypes } from "foldkit";

type Entry<Message> = SubscriptionTypes.EntryWithoutKeepAlive<unknown, Message, Readonly<Record<string, never>>, never>;

// Each event is stamped with the time it happened, so the Message alone tells update which entries have gone stale.
const stamped = <Message>(events: Stream.Stream<boolean>, toMessage: (now: number) => Message): Entry<Message> =>
  Subscription.persistentEntry(
    events.pipe(
      Stream.mapEffect(() => Clock.currentTimeMillis),
      Stream.map(toMessage),
    ),
  );

// A tab coming back into view counts as regaining focus; hiding it sends nothing.
const becameVisible = Dom.streamFromEventFilterMap({
  filterMapEvent: () => Option.liftPredicate(globalThis.document.visibilityState === "visible", Boolean),
  target: () => globalThis.document,
  type: "visibilitychange",
});

const wentOnline = Dom.streamFromEvent({ mapEvent: () => true, target: () => globalThis.window, type: "online" });

/** A Subscription entry that sends `toMessage(now)` each time the page becomes visible again. */
const revalidateOnFocus = <Message>(toMessage: (now: number) => Message): Entry<Message> =>
  stamped(becameVisible, toMessage);

/** A Subscription entry that sends `toMessage(now)` each time the browser comes back online. */
const revalidateOnReconnect = <Message>(toMessage: (now: number) => Message): Entry<Message> =>
  stamped(wentOnline, toMessage);

export { revalidateOnFocus, revalidateOnReconnect };
