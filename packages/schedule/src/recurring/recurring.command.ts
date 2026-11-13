import { Command, Event } from "@alchemy.run/domain";
import { Cron, DateTime, Option, Result, Schema } from "effect";

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

const Armed = Event("Armed", { cron: Schema.String, nextDue: Schema.DateTimeUtc, timeZone: Schema.String });

type Armed = typeof Armed.Type;

// The time the occurrence was due, the time it ran, and the next due time; at minus scheduledFor is how late it ran.
const Ticked = Event("Ticked", {
  at: Schema.DateTimeUtc,
  nextDue: Schema.DateTimeUtc,
  scheduledFor: Schema.DateTimeUtc,
});

type Ticked = typeof Ticked.Type;

const Paused = Event("Paused", {});

type Paused = typeof Paused.Type;

// Sent at every startup: arming again replaces the pending tick under the same name, and resumes a paused schedule.
const Arm = Command(
  "Arm",
  { events: [Armed], input: { cron: CronExpression, timeZone: TimeZoneName }, target: RecurringName },
  { description: "Start or restart a recurring schedule from a cron expression read in a time zone." },
);

type Arm = typeof Arm.Type;

// Scheduled, so it never rejects: a tick that is not the one the schedule waits for records nothing.
const Tick = Command(
  "Tick",
  { events: [Ticked], input: { scheduledFor: Schema.DateTimeUtc }, target: RecurringName },
  { description: "One occurrence of a recurring schedule is due." },
);

type Tick = typeof Tick.Type;

// The pending tick still fires, records nothing and arms nothing, so the chain stops until the next Arm.
const Pause = Command(
  "Pause",
  { events: [Paused], target: RecurringName },
  { description: "Stop a recurring schedule until it is armed again." },
);

export { Arm, Armed, Pause, Paused, Tick, Ticked };
