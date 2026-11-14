import { Policy } from "@alchemy.run/domain";
import { Effect, Number as Num } from "effect";

import { AttemptDelivery } from "#src/webhook/attempt-delivery/attempt-delivery.command.js";
import { Delivery } from "#src/webhook/delivery.aggregate.js";
import { AttemptFailed } from "#src/webhook/record-attempt/attempt-failed.event.js";

class ScheduleRetry extends Policy(
  "ScheduleRetry",
  { from: Delivery, on: [AttemptFailed] },
  { description: "Schedules the next attempt of a failed webhook delivery at the time it recorded." },
) {}

const ScheduleRetryLive = ScheduleRetry.toLayer(
  Effect.gen(function* scheduleRetryLive() {
    const deliveries = yield* Delivery;

    return Effect.fn("ScheduleRetry.handle")(function* handle({ event, source }) {
      yield* deliveries.schedule(source, AttemptDelivery.make({ attempt: Num.increment(event.attempt) }), {
        at: event.retryAt,
        commandId: `retry:${source.id}`,
      });
    });
  }),
);

export { ScheduleRetry, ScheduleRetryLive };
