import { Array as Arr, Duration, Function as Fn, Number as Num, Option } from "effect";

const retryDelays: readonly Duration.Duration[] = Arr.map(
  ["5 seconds", "5 minutes", "30 minutes", "2 hours", "5 hours", "10 hours", "10 hours"] as const,
  Duration.fromInputUnsafe,
);

const retryDelayArity = 2;

const delayAfter = (
  failedAttempt: number,
  retryAfter: Option.Option<Duration.Duration>,
): Option.Option<Duration.Duration> =>
  Option.map(Arr.get(retryDelays, Num.decrement(failedAttempt)), (delay) =>
    Option.match(retryAfter, { onNone: () => delay, onSome: (asked) => Duration.max(delay, asked) }),
  );

const retryDelay: {
  (retryAfter: Option.Option<Duration.Duration>): (failedAttempt: number) => Option.Option<Duration.Duration>;
  (failedAttempt: number, retryAfter: Option.Option<Duration.Duration>): Option.Option<Duration.Duration>;
} = Fn.dual(retryDelayArity, delayAfter);

export { retryDelay };
