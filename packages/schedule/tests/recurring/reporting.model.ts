import { Aggregate, Command, Event, Model, Policy } from "@alchemy.run/domain";
import { Story } from "@alchemy.run/domain/Story";
import { DateTime, Effect, Layer, Number as Num, Schema } from "effect";

import { RearmLive, Rearm } from "#src/recurring/tick/rearm.policy.js";
import { Recurring } from "#src/recurring/recurring.aggregate.js";
import { Ticked } from "#src/recurring/tick/ticked.event.js";

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

const report: Aggregate.Ref = Report.ref("nightly-report");

export { report, ReportCompiled, story };
