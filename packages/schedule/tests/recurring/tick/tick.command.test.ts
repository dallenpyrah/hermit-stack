import { Story } from "@alchemy.run/domain/Story";
import type { StoryFailure } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { Effect } from "effect";

import { Arm } from "#src/recurring/arm/arm.command.js";
import { Armed } from "#src/recurring/arm/armed.event.js";
import { Recurring } from "#src/recurring/recurring.aggregate.js";
import { Tick } from "#src/recurring/tick/tick.command.js";
import { Ticked } from "#src/recurring/tick/ticked.event.js";
import { report, ReportCompiled, story } from "#tests/recurring/reporting.model";

const { clock, then, when } = Story;

const nightly = Recurring.ref("nightly-report");

// Nine in the morning in New York is 14:00 UTC in January, so a schedule read in UTC would be due five hours early.
const cron = "0 9 * * *";
const timeZone = "America/New_York";
const arm = Arm.make({ cron, timeZone });
const firstDue = DateTime.makeUnsafe("2026-01-01T14:00:00Z");
const secondDue = DateTime.makeUnsafe("2026-01-02T14:00:00Z");
const thirdDue = DateTime.makeUnsafe("2026-01-03T14:00:00Z");
const fourthDue = DateTime.makeUnsafe("2026-01-04T14:00:00Z");
const backLate = DateTime.makeUnsafe("2026-01-03T15:00:00Z");
const armed = Armed.make({ cron, nextDue: firstDue, timeZone });
const firstTick = Ticked.make({ at: firstDue, nextDue: secondDue, scheduledFor: firstDue });
const secondTick = Ticked.make({ at: secondDue, nextDue: thirdDue, scheduledFor: secondDue });
const lateTick = Ticked.make({ at: backLate, nextDue: fourthDue, scheduledFor: secondDue });
const compiledFirst = ReportCompiled.make({ scheduledFor: firstDue });
const compiledSecond = ReportCompiled.make({ scheduledFor: secondDue });

const ticksAndRearms = (): Effect.Effect<void, StoryFailure> =>
  story(
    when(nightly, arm),
    then(nightly, armed),
    clock("2026-01-01T13:59:59Z"),
    then(nightly),
    then(report),
    clock(firstDue),
    then(nightly, firstTick),
    then(report, compiledFirst),
    clock(secondDue),
    then(nightly, secondTick),
    then(report, compiledSecond),
  );

const repeatedTickDoesNothing = (): Effect.Effect<void, StoryFailure> =>
  story(
    when(nightly, arm),
    then(nightly, armed),
    clock(firstDue),
    then(nightly, firstTick),
    then(report, compiledFirst),
    when(nightly, Tick.make({ scheduledFor: firstDue })),
    then(nightly),
    then(report),
    Story.state(report, { compiled: 1 }),
  );

const lateTickRunsOnce = (): Effect.Effect<void, StoryFailure> =>
  story(
    when(nightly, arm),
    then(nightly, armed),
    clock(firstDue),
    then(nightly, firstTick),
    then(report, compiledFirst),
    // The host was down through the second occurrence and the third: the pending tick runs once when it is back.
    clock(backLate),
    then(nightly, lateTick),
    then(report, compiledSecond),
  );

describe("a tick of a recurring schedule", () => {
  it.effect("runs at its due time, arms the next tick and runs again", ticksAndRearms);
  it.effect("does the work once when the same tick is delivered twice", repeatedTickDoesNothing);
  it.effect("runs once when it is late and is next due after it", lateTickRunsOnce);
});
