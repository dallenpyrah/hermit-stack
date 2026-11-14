import { Command } from "@alchemy.run/domain";
import { Function as Fn } from "effect";

import { CustomerId } from "#src/subscription/customer.id.js";
import { Ended, endedOf } from "#src/subscription/processor-report.schema.js";
import { precedence, recordIfNewer } from "#src/subscription/report-order.pure.js";
import { SubscriptionCancelled } from "#src/subscription/cancellation/subscription-cancelled.event.js";
import type { SubscriptionState } from "#src/subscription/subscription-state.schema.js";

class RecordSubscriptionCancelled extends Command(
  "RecordSubscriptionCancelled",
  { events: [SubscriptionCancelled], input: Ended, target: CustomerId },
  {
    description:
      "Report that the payment processor ended a customer's subscription. Only the processor's adapter sends it, and it is never refused.",
  },
) {}

const decideArity = 2;

const decideRecordSubscriptionCancelled: {
  (command: RecordSubscriptionCancelled): (state: SubscriptionState) => readonly SubscriptionCancelled[];
  (state: SubscriptionState, command: RecordSubscriptionCancelled): readonly SubscriptionCancelled[];
} = Fn.dual(
  decideArity,
  (state: SubscriptionState, command: RecordSubscriptionCancelled): readonly SubscriptionCancelled[] =>
    recordIfNewer(state, { at: command.reportedAt, precedence: precedence.cancelled }, () =>
      SubscriptionCancelled.make(endedOf(command)),
    ),
);

export { decideRecordSubscriptionCancelled, RecordSubscriptionCancelled };
