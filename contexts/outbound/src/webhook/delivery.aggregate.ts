import { Aggregate } from "@alchemy.run/domain";
import { Match, Number as Num } from "effect";

import { AttemptDelivery, decideAttemptDelivery } from "#src/webhook/attempt-delivery/attempt-delivery.command.js";
import { DeliveryId } from "#src/webhook/delivery.id.js";
import { DeliveryState, Fresh, Posting, Settled, Waiting } from "#src/webhook/delivery-state.schema.js";
import type { DeliveryOutcome, PostingState } from "#src/webhook/delivery-state.schema.js";
import { DeliveryTarget } from "#src/webhook/delivery-target.schema.js";
import { decideRecordAttempt, RecordAttempt } from "#src/webhook/record-attempt/record-attempt.command.js";
import { decideStartDelivery, StartDelivery } from "#src/webhook/start-delivery/start-delivery.command.js";

const firstAttempt = 1;

const targetOf = (posting: DeliveryTarget): DeliveryTarget =>
  DeliveryTarget.make({
    endpointId: posting.endpointId,
    event: posting.event,
    position: posting.position,
    tenant: posting.tenant,
    url: posting.url,
  });

// Every settling event moves a Posting delivery on and leaves any other state as it is.
const fromPosting =
  (next: (posting: PostingState) => DeliveryState) =>
  (state: DeliveryState): DeliveryState =>
    Match.valueTags(state, {
      Fresh: (fresh) => fresh,
      Posting: next,
      Settled: (settled) => settled,
      Waiting: (waiting) => waiting,
    });

const settled = (outcome: DeliveryOutcome, attempts: number): ((state: DeliveryState) => DeliveryState) =>
  fromPosting((posting) => Settled.make({ ...targetOf(posting), attempts, outcome }));

// One public event on its way to one endpoint, with its retries as state. Each command's rule lives in its own file
// Beside its events; this file holds the state and how events change it.
class Delivery extends Aggregate(
  "Delivery",
  {
    commands: [StartDelivery, AttemptDelivery, RecordAttempt],
    decide: {
      AttemptDelivery: decideAttemptDelivery,
      RecordAttempt: (state, command, { now }) => decideRecordAttempt(state, command, now),
      StartDelivery: decideStartDelivery,
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
