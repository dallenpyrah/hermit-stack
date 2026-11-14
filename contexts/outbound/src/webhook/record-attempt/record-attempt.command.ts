import { Command } from "@alchemy.run/domain";
import { DateTime, Duration, Function as Fn, Match, Option, Schema } from "effect";

import { DeliveryId } from "#src/webhook/delivery.id.js";
import type { DeliveryState } from "#src/webhook/delivery-state.schema.js";
import { Abandoned } from "#src/webhook/record-attempt/abandoned.event.js";
import { AttemptFailed } from "#src/webhook/record-attempt/attempt-failed.event.js";
import { AttemptOutcome } from "#src/webhook/record-attempt/attempt-outcome.schema.js";
import { Delivered } from "#src/webhook/record-attempt/delivered.event.js";
import { Exhausted } from "#src/webhook/record-attempt/exhausted.event.js";
import { retryDelay } from "#src/webhook/retry-delay.pure.js";

class RecordAttempt extends Command(
  "RecordAttempt",
  {
    events: [Delivered, Abandoned, AttemptFailed, Exhausted],
    input: { attempt: Schema.Int, outcome: AttemptOutcome },
    target: DeliveryId,
  },
  { description: "Record how one attempt to deliver a webhook went." },
) {}

type Settlement = Abandoned | AttemptFailed | Delivered | Exhausted;

interface Failure {
  readonly attempt: number;
  readonly reason: string;
  readonly retryAfter: Option.Option<Duration.Duration>;
}

const successStatuses = { maximum: 299, minimum: 200 };
const goneStatus = 410;

const fail = (failure: Failure, now: DateTime.Utc): readonly Settlement[] =>
  Option.match(retryDelay(failure.attempt, failure.retryAfter), {
    onNone: () => [Exhausted.make({ attempts: failure.attempt, reason: failure.reason })],
    onSome: (delay) => [
      AttemptFailed.make({
        attempt: failure.attempt,
        reason: failure.reason,
        retryAt: DateTime.addDuration(now, delay),
      }),
    ],
  });

const isSuccess = (status: number): boolean => status >= successStatuses.minimum && status <= successStatuses.maximum;

const settle = (command: RecordAttempt, now: DateTime.Utc): readonly Settlement[] =>
  Match.valueTags(command.outcome, {
    Responded: (response) => {
      if (isSuccess(response.status)) {
        return [Delivered.make({ attempt: command.attempt })];
      }

      if (response.status === goneStatus) {
        return [Abandoned.make({ attempt: command.attempt })];
      }

      const retryAfter = Option.map(response.retryAfterSeconds, Duration.seconds);

      return fail({ attempt: command.attempt, reason: `status ${response.status}`, retryAfter }, now);
    },
    Unreachable: (unreachable) =>
      fail({ attempt: command.attempt, reason: unreachable.reason, retryAfter: Option.none() }, now),
  });

const decideArity = 3;

const decideRecordAttempt: {
  (command: RecordAttempt, now: DateTime.Utc): (state: DeliveryState) => readonly Settlement[];
  (state: DeliveryState, command: RecordAttempt, now: DateTime.Utc): readonly Settlement[];
} = Fn.dual(decideArity, (state: DeliveryState, command: RecordAttempt, now: DateTime.Utc): readonly Settlement[] =>
  Match.valueTags(state, {
    Fresh: () => [],
    Posting: (posting) => {
      if (posting.attempt !== command.attempt) {
        return [];
      }

      return settle(command, now);
    },
    Settled: () => [],
    Waiting: () => [],
  }),
);

export { decideRecordAttempt, RecordAttempt };
