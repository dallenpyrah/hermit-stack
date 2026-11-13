import { Command } from "@alchemy.run/domain";
import { Array as Arr, Cron, DateTime, Function as Fn, Option, Result, Schema } from "effect";

import { Armed } from "#src/recurring/arm/armed.event.js";
import { nextAfter } from "#src/recurring/next-occurrence.pure.js";
import { RecurringName } from "#src/recurring/recurring.id.js";

// A cron expression is checked where it enters, so Arm never has to refuse one.
const CronExpression = Schema.String.check(
  Schema.makeFilter((cron: string) => Result.isSuccess(Cron.parse(cron)) || "a cron expression with 5 or 6 fields"),
);

const TimeZoneName = Schema.String.check(
  Schema.makeFilter(
    (zone: string) => Option.isSome(DateTime.zoneFromString(zone)) || "an IANA time zone, such as Europe/Paris",
  ),
);

// Sent at every startup: arming again replaces the pending tick under the same name, and resumes a paused schedule.
class Arm extends Command(
  "Arm",
  { events: [Armed], input: { cron: CronExpression, timeZone: TimeZoneName }, target: RecurringName },
  { description: "Start or restart a recurring schedule from a cron expression read in a time zone." },
) {}

const decideArity = 2;

const decideArm: {
  (now: DateTime.Utc): (command: Arm) => readonly Armed[];
  (command: Arm, now: DateTime.Utc): readonly Armed[];
} = Fn.dual(decideArity, (command: Arm, now: DateTime.Utc): readonly Armed[] =>
  Arr.map(nextAfter(command, now), (nextDue) =>
    Armed.make({ cron: command.cron, nextDue, timeZone: command.timeZone }),
  ),
);

export { Arm, decideArm };
