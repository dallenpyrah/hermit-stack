import { Layer } from "effect";

import { WritePublicEventsLive } from "#src/feed/public-events.projection.js";
import { DispatchNotificationLive, NotifyAudienceLive } from "#src/notification/notification.policy.js";
import {
  PostDeliveryLive,
  ScheduleRetryLive,
  StartDeliveriesLive,
  TrackEndpointHealthLive,
} from "#src/webhook/delivery.policy.js";

// The Outbound model's policies and projection. A host provides the Email, Push and WebhookTransport adapters.
const OutboundHandlers = Layer.mergeAll(
  WritePublicEventsLive,
  NotifyAudienceLive,
  DispatchNotificationLive,
  StartDeliveriesLive,
  PostDeliveryLive,
  ScheduleRetryLive,
  TrackEndpointHealthLive,
);

export { OutboundHandlers };
