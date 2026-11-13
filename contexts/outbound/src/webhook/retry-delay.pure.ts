import { Array as Arr, Duration, Function as Fn, Number as Num, Option } from "effect";

// The schedule Standard Webhooks suggests after the first attempt: about a day and a half in all, then give up.
const retryDelays: readonly Duration.Duration[] = Arr.map(
  ["5 seconds", "5 minutes", "30 minutes", "2 hours", "5 hours", "10 hours", "10 hours"] as const,
  Duration.fromInputUnsafe,
);

const retryDelayArity = 2;

// How long to wait after the given attempt failed, or none when it was the last of eight. A longer retry-after from
// The receiver wins, so a receiver that asks for time gets it.
const retryDelay: {
  (retryAfter: Option.Option<Duration.Duration>): (failedAttempt: number) => Option.Option<Duration.Duration>;
  (failedAttempt: number, retryAfter: Option.Option<Duration.Duration>): Option.Option<Duration.Duration>;
} = Fn.dual(
  retryDelayArity,
  (failedAttempt: number, retryAfter: Option.Option<Duration.Duration>): Option.Option<Duration.Duration> =>
    Option.map(Arr.get(retryDelays, Num.decrement(failedAttempt)), (delay) =>
      Option.match(retryAfter, { onNone: () => delay, onSome: (asked) => Duration.max(delay, asked) }),
    ),
);

export { retryDelay };
