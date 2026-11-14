import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { EndpointId } from "#src/webhook/endpoint.id.js";
import { Delivered } from "#src/webhook/record-attempt/delivered.event.js";
import { EndpointDisabled } from "#src/webhook/record-outcome/endpoint-disabled.event.js";
import { EndpointRegistered } from "#src/webhook/register-endpoint/endpoint-registered.event.js";
import { DeliveryStarted } from "#src/webhook/start-delivery/delivery-started.event.js";
import { outboundStory } from "#tests/outbound.suite";
import { attempt, delivery, endpointId, endpoints, published } from "#tests/webhook/delivery.suite";
import { answeredNoContent, postedToEndpoint } from "#tests/webhook/record-attempt/transport-answer.suite";

const { given, then } = Story;

type Case = () => ReturnType<typeof outboundStory>;

const oldUrl = "https://old.example.com/hooks";
const otherType = EndpointId.make("endpoint-2");
const disabled = EndpointId.make("endpoint-3");

const [, publish, recordedInFeed] = published;

const startsOnlyMatchingActiveEndpoints: Case = () =>
  outboundStory(
    given(
      endpoints,
      EndpointRegistered.make({ endpointId, eventTypes: ["invoice.paid"], url: oldUrl }),
      EndpointRegistered.make({ endpointId, eventTypes: ["invoice.paid"], url: attempt.url }),
      EndpointRegistered.make({ endpointId: otherType, eventTypes: ["invoice.voided"], url: oldUrl }),
      EndpointRegistered.make({ endpointId: disabled, eventTypes: ["invoice.paid"], url: oldUrl }),
      EndpointDisabled.make({ endpointId: disabled, reason: "failing" }),
    ),
    publish,
    recordedInFeed,
    then(delivery, DeliveryStarted.make({ ...attempt, tenant: endpoints.id })),
    ...postedToEndpoint,
    ...answeredNoContent,
    then(delivery, Delivered.make({ attempt: 1 })),
  );

describe("a public event published for a tenant", () => {
  it.effect("starts a delivery to each active endpoint that takes its type", startsOnlyMatchingActiveEndpoints);
});
