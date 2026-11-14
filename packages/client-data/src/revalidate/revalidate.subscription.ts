import { Clock, Option, Stream } from "effect";
import { Dom, Subscription } from "foldkit";
import type { Subscription as SubscriptionTypes } from "foldkit";

type Entry<Message> = SubscriptionTypes.EntryWithoutKeepAlive<unknown, Message, Readonly<Record<string, never>>, never>;

const stamped = <Message>(events: Stream.Stream<boolean>, toMessage: (now: number) => Message): Entry<Message> =>
  Subscription.persistentEntry(
    events.pipe(
      Stream.mapEffect(() => Clock.currentTimeMillis),
      Stream.map(toMessage),
    ),
  );

const becameVisible = Dom.streamFromEventFilterMap({
  filterMapEvent: () => Option.liftPredicate(globalThis.document.visibilityState === "visible", Boolean),
  target: () => globalThis.document,
  type: "visibilitychange",
});

const wentOnline = Dom.streamFromEvent({ mapEvent: () => true, target: () => globalThis.window, type: "online" });

const revalidateOnFocus = <Message>(toMessage: (now: number) => Message): Entry<Message> =>
  stamped(becameVisible, toMessage);

const revalidateOnReconnect = <Message>(toMessage: (now: number) => Message): Entry<Message> =>
  stamped(wentOnline, toMessage);

export { revalidateOnFocus, revalidateOnReconnect };
