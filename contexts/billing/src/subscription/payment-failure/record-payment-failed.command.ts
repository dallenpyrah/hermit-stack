import { Command } from "@alchemy.run/domain";
import { Function as Fn } from "effect";

import { CustomerId } from "#src/subscription/customer.id.js";
import { Held, heldOf } from "#src/subscription/processor-report.schema.js";
import { precedence, recordIfNewer } from "#src/subscription/report-order.pure.js";
import { PaymentFailed } from "#src/subscription/payment-failure/payment-failed.event.js";
import type { SubscriptionState } from "#src/subscription/subscription-state.schema.js";

class RecordPaymentFailed extends Command(
  "RecordPaymentFailed",
  { events: [PaymentFailed], input: Held, target: CustomerId },
  {
    description:
      "Report that a renewal payment failed and the processor will retry it. Only the processor's adapter sends it, and it is never refused.",
  },
) {}

const decideArity = 2;

const decideRecordPaymentFailed: {
  (command: RecordPaymentFailed): (state: SubscriptionState) => readonly PaymentFailed[];
  (state: SubscriptionState, command: RecordPaymentFailed): readonly PaymentFailed[];
} = Fn.dual(decideArity, (state: SubscriptionState, command: RecordPaymentFailed): readonly PaymentFailed[] =>
  recordIfNewer(state, { at: command.reportedAt, precedence: precedence.paymentFailed }, () =>
    PaymentFailed.make(heldOf(command)),
  ),
);

export { decideRecordPaymentFailed, RecordPaymentFailed };
