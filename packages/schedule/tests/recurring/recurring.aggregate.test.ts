import { Aggregate, Command, Event, Model, Policy } from "@alchemy.run/domain";
import { Story } from "@alchemy.run/domain/Story";
import type { StoryFailure } from "@alchemy.run/domain/Story";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Number as Num, Option, Schema } from "effect";

import { RearmLive, Rearm } from "#src/recurring/rearm.policy.js";
import { Recurring } from "#src/recurring/recurring.aggregate.js";
import { Arm, Armed, Pause, Paused, Tick, Ticked } from "#src/recurring/recurring.command.js";

const { clock, then, when } = Story;

// The work a schedule triggers in these stories: one report per occurrence, keyed like the schedule.
const ReportId = Schema.String.pipe(Schema.brand("ReportId"));

const ReportCompiled = Event("ReportCompiled", { scheduledFor: Schema.DateTimeUtc });

const CompileReport = Command("CompileReport", {
  events: [ReportCompiled],
  input: { scheduledFor: Schema.DateTimeUtc },
  target: ReportId,
});

const Report = Aggregate("Report", {
  commands: [CompileReport],
  decide: { CompileReport: (_state, command) => [ReportCompiled.make({ scheduledFor: command.scheduledFor })] },
  evolve: { ReportCompiled: (state) => ({ compiled: Num.increment(state.compiled) }) },
  id: ReportId,
  initial: { compiled: 0 },
  state: Schema.Struct({ compiled: Schema.Int }),
});

const CompileOnTick = Policy("CompileOnTick", { from: Recurring, on: [Ticked] });

const CompileOnTickLive = CompileOnTick.toLayer(
  Effect.gen(function* compileOnTickLive() {
    const reports = yield* Report;

    return Effect.fn("CompileOnTick.handle")(function* handle({ event, source }) {
      yield* reports.send(ReportId.make(source.id), CompileReport.make({ scheduledFor: event.scheduledFor }), {
        commandId: `${source.id}:${DateTime.formatIso(event.scheduledFor)}`,
      });
    });
  }),
);

const Reporting = Model("Reporting", { aggregates: [Recurring, Report], policies: [Rearm, CompileOnTick] });

const story = Story.make(Reporting, { layer: Layer.mergeAll(RearmLive, CompileOnTickLive) });

const nightly = Recurring.ref("nightly-report");
const report = Report.ref("nightly-report");

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
const rearmedTick = Ticked.make({ at: thirdDue, nextDue: fourthDue, scheduledFor: thirdDue });
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

const pauseStopsTheChain = (): Effect.Effect<void, StoryFailure> =>
  story(
    when(nightly, arm),
    then(nightly, armed),
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

const refusesUnreadableSettings = (): void => {
  expect(Option.isSome(Arm.makeOption({ cron, timeZone }))).toBe(true);
  expect(Option.isNone(Arm.makeOption({ cron: "every morning", timeZone }))).toBe(true);
  expect(Option.isNone(Arm.makeOption({ cron, timeZone: "Mars/Olympus" }))).toBe(true);
};

describe("a recurring schedule", () => {
  it.effect("ticks at its due time, arms the next tick and ticks again", ticksAndRearms);
  it.effect("does the work once when the same tick is delivered twice", repeatedTickDoesNothing);
  it.effect("runs a late tick once and is next due after it", lateTickRunsOnce);
  it.effect("stops ticking while paused and starts again when armed", pauseStopsTheChain);
  it.effect("cannot be armed with a cron expression or time zone it cannot read", () =>
    Effect.sync(refusesUnreadableSettings),
  );
});
