import { Command, Event } from "@alchemy.run/domain";
import { Schema } from "effect";

import { PublicEvent } from "#src/feed/public-event.schema.js";
import { TenantId } from "#src/feed/tenant.id.js";
import { DeliveryId } from "#src/webhook/delivery.id.js";
import { EndpointId } from "#src/webhook/endpoint.id.js";

const DeliveryTarget = Schema.Struct({
  endpointId: EndpointId,
  event: PublicEvent,
  position: Schema.Int,
  tenant: TenantId,
  url: Schema.String,
});

type DeliveryTarget = typeof DeliveryTarget.Type;

const DeliveryStarted = Event("DeliveryStarted", DeliveryTarget.fields);

type DeliveryStarted = typeof DeliveryStarted.Type;

// Sent by a policy, so it never rejects: starting a delivery that already started records nothing.
const StartDelivery = Command(
  "StartDelivery",
  { events: [DeliveryStarted], input: DeliveryTarget.fields, target: DeliveryId },
  { description: "Start delivering one public event to one webhook endpoint." },
);

type StartDelivery = typeof StartDelivery.Type;

const AttemptStarted = Event("AttemptStarted", { attempt: Schema.Int });

type AttemptStarted = typeof AttemptStarted.Type;

// Scheduled at the retry time, so it never rejects: an attempt the delivery no longer waits for records nothing.
const AttemptDelivery = Command(
  "AttemptDelivery",
  { events: [AttemptStarted], input: { attempt: Schema.Int }, target: DeliveryId },
  { description: "A retry of a webhook delivery is due." },
);

type AttemptDelivery = typeof AttemptDelivery.Type;

// The receiver answered with a status, and maybe a retry-after in seconds; or no answer came at all.
const Responded = Schema.TaggedStruct("Responded", {
  retryAfterSeconds: Schema.Option(Schema.Int),
  status: Schema.Int,
});

const Unreachable = Schema.TaggedStruct("Unreachable", { reason: Schema.String });

const Delivered = Event("Delivered", { attempt: Schema.Int });

type Delivered = typeof Delivered.Type;

// The receiver answered 410 Gone, so the delivery stops and its endpoint is disabled.
const Abandoned = Event("Abandoned", { attempt: Schema.Int });

type Abandoned = typeof Abandoned.Type;

const AttemptFailed = Event("AttemptFailed", {
  attempt: Schema.Int,
  reason: Schema.String,
  retryAt: Schema.DateTimeUtc,
});

type AttemptFailed = typeof AttemptFailed.Type;

const Exhausted = Event("Exhausted", { attempts: Schema.Int, reason: Schema.String });

type Exhausted = typeof Exhausted.Type;

// Reports what the transport saw, so it never rejects: an answer for an attempt that is no longer in flight records
// Nothing.
const RecordAttempt = Command(
  "RecordAttempt",
  {
    events: [Delivered, Abandoned, AttemptFailed, Exhausted],
    input: { attempt: Schema.Int, outcome: Schema.Union([Responded, Unreachable]) },
    target: DeliveryId,
  },
  { description: "Record how one attempt to deliver a webhook went." },
);

type RecordAttempt = typeof RecordAttempt.Type;

export {
  Abandoned,
  AttemptDelivery,
  AttemptFailed,
  AttemptStarted,
  Delivered,
  DeliveryStarted,
  DeliveryTarget,
  Exhausted,
  RecordAttempt,
  Responded,
  StartDelivery,
  Unreachable,
};
