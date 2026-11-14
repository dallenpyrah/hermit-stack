import { Story } from "@alchemy.run/domain/Story";
import type { Step } from "@alchemy.run/domain/Story";
import { Option } from "effect";

import { EndpointId } from "#src/webhook/endpoint.id.js";
import { Responded } from "#src/webhook/record-attempt/attempt-outcome.schema.js";
import { WebhookTransport } from "#src/webhook/webhook-transport.external.js";

const retryAfterSeconds = Option.none<number>();

const postedToEndpoint = [
  Story.call(WebhookTransport.post, { endpointId: EndpointId.make("endpoint-1"), position: 1 }),
] as const satisfies readonly Step[];

const answeredNoContent = [
  Story.succeed(WebhookTransport.post, { retryAfterSeconds, status: 204 }),
] as const satisfies readonly Step[];

const answeredGone = [
  Story.succeed(WebhookTransport.post, { retryAfterSeconds, status: 410 }),
] as const satisfies readonly Step[];

const unavailable = Responded.make({ retryAfterSeconds, status: 503 });

const noContent = Responded.make({ retryAfterSeconds, status: 204 });

export { answeredGone, answeredNoContent, noContent, postedToEndpoint, unavailable };
