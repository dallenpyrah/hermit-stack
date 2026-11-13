import { Aggregate } from "@alchemy.run/domain";
import { DateTime, Duration, Match, Number as Num, Option, Schema } from "effect";

import {
  Abandoned,
  AttemptDelivery,
  AttemptFailed,
  AttemptStarted,
  Delivered,
  DeliveryStarted,
  DeliveryTarget,
  Exhausted,
  RecordAttempt,
  StartDelivery,
} from "#src/webhook/delivery.command.js";
import { DeliveryId } from "#src/webhook/delivery.id.js";
import { retryDelay } from "#src/webhook/retry-delay.pure.js";

const firstAttempt = 1;
const successStatuses = { maximum: 299, minimum: 200 };
const goneStatus = 410;

const Fresh = Schema.TaggedStruct("Fresh", {});

const Posting = Schema.TaggedStruct("Posting", { ...DeliveryTarget.fields, attempt: Schema.Int });

const Waiting = Schema.TaggedStruct("Waiting", { ...DeliveryTarget.fields, attempt: Schema.Int });

const Settled = Schema.TaggedStruct("Settled", {
  ...DeliveryTarget.fields,
  attempts: Schema.Int,
  outcome: Schema.Literals(["delivered", "exhausted", "gone"]),
});

const DeliveryState = Schema.Union([Fresh, Posting, Waiting, Settled]);

type DeliveryState = typeof DeliveryState.Type;

type Posting = typeof Posting.Type;

type Settlement = Abandoned | AttemptFailed | Delivered | Exhausted;

interface Failure {
  readonly attempt: number;
  readonly reason: string;
  readonly retryAfter: Option.Option<Duration.Duration>;
}

const targetOf = (posting: DeliveryTarget): DeliveryTarget =>
  DeliveryTarget.make({
    endpointId: posting.endpointId,
    event: posting.event,
    position: posting.position,
    tenant: posting.tenant,
    url: posting.url,
  });

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

// A 2xx delivers, a 410 abandons, and anything else, no answer included, is retried until the schedule runs out.
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

const recordAttempt = (state: DeliveryState, command: RecordAttempt, now: DateTime.Utc): readonly Settlement[] =>
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
  });

const attemptDelivery = (state: DeliveryState, command: AttemptDelivery): readonly AttemptStarted[] =>
  Match.valueTags(state, {
    Fresh: () => [],
    Posting: () => [],
    Settled: () => [],
    Waiting: (waiting) => {
      if (waiting.attempt !== command.attempt) {
        return [];
      }

      return [AttemptStarted.make({ attempt: command.attempt })];
    },
  });

const startDelivery = (state: DeliveryState, command: StartDelivery): readonly DeliveryStarted[] =>
  Match.valueTags(state, {
    Fresh: () => [
      DeliveryStarted.make({
        endpointId: command.endpointId,
        event: command.event,
        position: command.position,
        tenant: command.tenant,
        url: command.url,
      }),
    ],
    Posting: () => [],
    Settled: () => [],
    Waiting: () => [],
  });

// Every settling event moves a Posting delivery on and leaves any other state as it is.
const fromPosting =
  (next: (posting: Posting) => DeliveryState) =>
  (state: DeliveryState): DeliveryState =>
    Match.valueTags(state, {
      Fresh: (fresh) => fresh,
      Posting: next,
      Settled: (settled) => settled,
      Waiting: (waiting) => waiting,
    });

const settled = (
  outcome: "delivered" | "exhausted" | "gone",
  attempts: number,
): ((state: DeliveryState) => DeliveryState) =>
  fromPosting((posting) => Settled.make({ ...targetOf(posting), attempts, outcome }));

// One public event on its way to one endpoint, with its retries as state: Posting while an attempt is in flight,
// Waiting until the scheduled retry, then Settled.
class Delivery extends Aggregate(
  "Delivery",
  {
    commands: [StartDelivery, AttemptDelivery, RecordAttempt],
    decide: {
      AttemptDelivery: (state, command) => attemptDelivery(state, command),
      RecordAttempt: (state, command, { now }) => recordAttempt(state, command, now),
      StartDelivery: (state, command) => startDelivery(state, command),
    },
    evolve: {
      Abandoned: (state, event) => settled("gone", event.attempt)(state),
      AttemptFailed: (state, event) =>
        fromPosting((posting) => Waiting.make({ ...targetOf(posting), attempt: Num.increment(event.attempt) }))(state),
      AttemptStarted: (state, event) =>
        Match.valueTags(state, {
          Fresh: (fresh) => fresh,
          Posting: (posting) => posting,
          Settled: (done) => done,
          Waiting: (waiting) => Posting.make({ ...targetOf(waiting), attempt: event.attempt }),
        }),
      Delivered: (state, event) => settled("delivered", event.attempt)(state),
      DeliveryStarted: (_state, event) =>
        Posting.make({
          attempt: firstAttempt,
          endpointId: event.endpointId,
          event: event.event,
          position: event.position,
          tenant: event.tenant,
          url: event.url,
        }),
      Exhausted: (state, event) => settled("exhausted", event.attempts)(state),
    },
    id: DeliveryId,
    initial: Fresh.make({}),
    state: DeliveryState,
  },
  { description: "One public event on its way to one webhook endpoint, with every attempt and retry." },
) {}

export { Delivery };
