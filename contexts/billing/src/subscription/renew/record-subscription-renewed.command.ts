import { Command } from "@alchemy.run/domain";
import { Function as Fn } from "effect";

import { CustomerId } from "#src/subscription/customer.id.js";
import { Held, heldOf } from "#src/subscription/processor-report.schema.js";
import { precedence, recordIfNewer } from "#src/subscription/report-order.pure.js";
import { SubscriptionRenewed } from "#src/subscription/renew/subscription-renewed.event.js";
import type { SubscriptionState } from "#src/subscription/subscription-state.schema.js";

class RecordSubscriptionRenewed extends Command(
  "RecordSubscriptionRenewed",
  { events: [SubscriptionRenewed], input: Held, target: CustomerId },
  {
    description:
      "Report that the payment processor took a renewal payment. Only the processor's adapter sends it, and it is never refused.",
  },
) {}

const decideArity = 2;

const decideRecordSubscriptionRenewed: {
  (command: RecordSubscriptionRenewed): (state: SubscriptionState) => readonly SubscriptionRenewed[];
  (state: SubscriptionState, command: RecordSubscriptionRenewed): readonly SubscriptionRenewed[];
} = Fn.dual(
  decideArity,
  (state: SubscriptionState, command: RecordSubscriptionRenewed): readonly SubscriptionRenewed[] =>
    recordIfNewer(state, { at: command.reportedAt, precedence: precedence.renewed }, () =>
      SubscriptionRenewed.make(heldOf(command)),
    ),
);

export { decideRecordSubscriptionRenewed, RecordSubscriptionRenewed };
