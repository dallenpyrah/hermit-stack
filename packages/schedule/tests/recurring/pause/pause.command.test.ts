import { Story } from "@alchemy.run/domain/Story";
import type { StoryFailure } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { Effect } from "effect";

import { Arm } from "#src/recurring/arm/arm.command.js";
import { Armed } from "#src/recurring/arm/armed.event.js";
import { Pause } from "#src/recurring/pause/pause.command.js";
import { Paused } from "#src/recurring/pause/paused.event.js";
import { Recurring } from "#src/recurring/recurring.aggregate.js";
import { Ticked } from "#src/recurring/tick/ticked.event.js";
import { report, ReportCompiled, story } from "#tests/recurring/reporting.model";

const { clock, then, when } = Story;

const nightly = Recurring.ref("nightly-report");

// Nine in the morning in New York is 14:00 UTC in January.
const cron = "0 9 * * *";
const timeZone = "America/New_York";
const arm = Arm.make({ cron, timeZone });
const firstDue = DateTime.makeUnsafe("2026-01-01T14:00:00Z");
const secondDue = DateTime.makeUnsafe("2026-01-02T14:00:00Z");
const thirdDue = DateTime.makeUnsafe("2026-01-03T14:00:00Z");
const fourthDue = DateTime.makeUnsafe("2026-01-04T14:00:00Z");
const rearmedTick = Ticked.make({ at: thirdDue, nextDue: fourthDue, scheduledFor: thirdDue });

const pauseStopsTheChain = (): Effect.Effect<void, StoryFailure> =>
  story(
    when(nightly, arm),
    then(nightly, Armed.make({ cron, nextDue: firstDue, timeZone })),
    when(nightly, Pause.make({})),
    then(nightly, Paused.make({})),
    clock(secondDue),
    then(nightly),
    then(report),
    when(nightly, arm),
    then(nightly, Armed.make({ cron, nextDue: thirdDue, timeZone })),
    clock(thirdDue),
    then(nightly, rearmedTick),
    then(report, ReportCompiled.make({ scheduledFor: thirdDue })),
  );

describe("a paused recurring schedule", () => {
  it.effect("stops ticking and starts again when armed", pauseStopsTheChain);
});
