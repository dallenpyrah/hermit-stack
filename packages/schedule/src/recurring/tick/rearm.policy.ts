import { Policy } from "@alchemy.run/domain";
import { Effect } from "effect";

import { Armed } from "#src/recurring/arm/armed.event.js";
import { Recurring } from "#src/recurring/recurring.aggregate.js";
import { Tick } from "#src/recurring/tick/tick.command.js";
import { Ticked } from "#src/recurring/tick/ticked.event.js";

// Every arming and every tick schedules the next Tick under one name per schedule, so a new arming replaces the
// Pending one and a schedule never has two ticks waiting.
class Rearm extends Policy(
  "Rearm",
  { from: Recurring, on: [Armed, Ticked] },
  { description: "Schedules the next tick of a recurring schedule when it is armed or ticks." },
) {}

const RearmLive = Rearm.toLayer(
  Effect.gen(function* rearmLive() {
    const schedules = yield* Recurring;

    return Effect.fn("Rearm.handle")(function* handle({ event, source }) {
      yield* schedules.schedule(source, Tick.make({ scheduledFor: event.nextDue }), {
        at: event.nextDue,
        commandId: `tick:${source.id}`,
      });
    });
  }),
);

export { Rearm, RearmLive };
