import { Cron, DateTime, Function as Fn, Result } from "effect";

interface CronSettings {
  readonly cron: string;
  readonly timeZone: string;
}

const nextAfterArity = 2;

// The next occurrence strictly after a time, read in the schedule's own time zone. Arm's input schema already accepted
// The expression and the zone, so a parse that fails here has no next occurrence.
const nextAfter: {
  (after: DateTime.Utc): (settings: CronSettings) => readonly DateTime.Utc[];
  (settings: CronSettings, after: DateTime.Utc): readonly DateTime.Utc[];
} = Fn.dual(nextAfterArity, (settings: CronSettings, after: DateTime.Utc): readonly DateTime.Utc[] =>
  Result.match(Cron.parse(settings.cron, settings.timeZone), {
    onFailure: () => [],
    onSuccess: (cron) => [DateTime.fromDateUnsafe(Cron.next(cron, after))],
  }),
);

export { nextAfter };
