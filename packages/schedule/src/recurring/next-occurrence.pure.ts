import { Cron, DateTime, Function as Fn, Result } from "effect";

interface CronSettings {
  readonly cron: string;
  readonly timeZone: string;
}

const nextAfterArity = 2;

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
