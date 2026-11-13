import { Story } from "@alchemy.run/domain/Story";
import type { Step, StoryFailure } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import { Array as Arr, Number as Num } from "effect";
import type { Effect } from "effect";

import { EndpointDisabled } from "#src/webhook/record-outcome/endpoint-disabled.event.js";
import { FailureCounted } from "#src/webhook/record-outcome/failure-counted.event.js";
import { FailuresCleared } from "#src/webhook/record-outcome/failures-cleared.event.js";
import { RecordDeliveryOutcome } from "#src/webhook/record-outcome/record-delivery-outcome.command.js";
import { outboundStory } from "#tests/outbound.suite";
import { endpointId, endpoints, registered } from "#tests/webhook/delivery.suite";

const { then, when } = Story;

const exhausted = when(endpoints, RecordDeliveryOutcome.make({ endpointId, outcome: "exhausted" }));

const countedTo = (failuresInRow: number): readonly Step[] => [
  exhausted,
  then(endpoints, FailureCounted.make({ endpointId, failuresInRow })),
];

// One short of the five in a row that disable an endpoint.
const oneShort = 4;

// Failures one to four, each counted.
const fourFailures = Arr.flatMap(Arr.makeBy(oneShort, Num.increment), countedTo);

const disabledAfterFiveInRow = (): Effect.Effect<void, StoryFailure> =>
  outboundStory(
    registered,
    ...fourFailures,
    when(endpoints, RecordDeliveryOutcome.make({ endpointId, outcome: "delivered" })),
    then(endpoints, FailuresCleared.make({ endpointId })),
    // Eight failures in all by the end of these, but only four in a row, so the endpoint stays active.
    ...fourFailures,
    exhausted,
    then(
      endpoints,
      FailureCounted.make({ endpointId, failuresInRow: 5 }),
      EndpointDisabled.make({ endpointId, reason: "failing" }),
    ),
    // A delivery still in flight when the endpoint was disabled ends later and changes nothing.
    exhausted,
    then(endpoints),
  );

describe("an endpoint whose deliveries keep running out of retries", () => {
  it.effect(
    "is disabled at the fifth in a row, and a success in between starts the count again",
    disabledAfterFiveInRow,
  );
});
