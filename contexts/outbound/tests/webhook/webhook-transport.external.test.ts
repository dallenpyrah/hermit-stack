import { it } from "@effect/vitest";

import { WebhookTransportFake } from "#tests/webhook/webhook-transport.fake";
import { webhookTransportContract } from "#tests/webhook/webhook-transport.suite";

it.layer(WebhookTransportFake)("the in-memory webhook transport fake", webhookTransportContract);
