import { Command } from "@alchemy.run/domain";
import { Function as Fn } from "effect";

import { CustomerId } from "#src/subscription/customer.id.js";
import { Held, heldOf } from "#src/subscription/processor-report.schema.js";
import { precedence, recordIfNewer } from "#src/subscription/report-order.pure.js";
import { SubscriptionStarted } from "#src/subscription/start/subscription-started.event.js";
import type { SubscriptionState } from "#src/subscription/subscription-state.schema.js";

class RecordSubscriptionStarted extends Command(
  "RecordSubscriptionStarted",
  { events: [SubscriptionStarted], input: Held, target: CustomerId },
  {
    description:
      "Report that the payment processor took the first payment of a customer's subscription. Only the processor's adapter sends it, and it is never refused.",
  },
) {}

const decideArity = 2;

const decideRecordSubscriptionStarted: {
  (command: RecordSubscriptionStarted): (state: SubscriptionState) => readonly SubscriptionStarted[];
  (state: SubscriptionState, command: RecordSubscriptionStarted): readonly SubscriptionStarted[];
} = Fn.dual(
  decideArity,
  (state: SubscriptionState, command: RecordSubscriptionStarted): readonly SubscriptionStarted[] =>
    recordIfNewer(state, { at: command.reportedAt, precedence: precedence.started }, () =>
      SubscriptionStarted.make(heldOf(command)),
    ),
);

export { decideRecordSubscriptionStarted, RecordSubscriptionStarted };
