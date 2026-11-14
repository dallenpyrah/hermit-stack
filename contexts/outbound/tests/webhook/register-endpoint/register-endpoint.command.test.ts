import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { EndpointDisabled } from "#src/webhook/record-outcome/endpoint-disabled.event.js";
import { FailureCounted } from "#src/webhook/record-outcome/failure-counted.event.js";
import { RecordDeliveryOutcome } from "#src/webhook/record-outcome/record-delivery-outcome.command.js";
import { EndpointRegistered } from "#src/webhook/register-endpoint/endpoint-registered.event.js";
import { RegisterEndpoint } from "#src/webhook/register-endpoint/register-endpoint.command.js";
import { outboundStory } from "#tests/outbound.suite";
import { endpointId, endpoints } from "#tests/webhook/delivery.suite";

const { given, then, when } = Story;

type Case = () => ReturnType<typeof outboundStory>;

const url = "https://receiver.example.com/hooks";
const eventTypes = ["invoice.paid", "invoice.voided"];
const exhausted = RecordDeliveryOutcome.make({ endpointId, outcome: "exhausted" });

const startsAfresh: Case = () =>
  outboundStory(
    given(
      endpoints,
      EndpointRegistered.make({ endpointId, eventTypes: ["invoice.paid"], url: "https://old.example.com/hooks" }),
      FailureCounted.make({ endpointId, failuresInRow: 4 }),
      EndpointDisabled.make({ endpointId, reason: "failing" }),
    ),
    when(endpoints, RegisterEndpoint.make({ endpointId, eventTypes, url })),
    then(endpoints, EndpointRegistered.make({ endpointId, eventTypes, url })),
    when(endpoints, exhausted),
    then(endpoints, FailureCounted.make({ endpointId, failuresInRow: 1 })),
  );

describe("registering a webhook endpoint", () => {
  it.effect("replaces an endpoint with that id and starts it afresh, even a disabled one", startsAfresh);
});
