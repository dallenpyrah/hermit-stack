import { Layer } from "effect";

import { WritePublicEventsLive } from "#src/feed/public-events.projection.js";
import { NotifyAudienceLive } from "#src/notification/notify/notify-audience.policy.js";
import { DispatchNotificationLive } from "#src/notification/record-delivery/dispatch-notification.policy.js";
import { ScheduleRetryLive } from "#src/webhook/attempt-delivery/schedule-retry.policy.js";
import { PostDeliveryLive } from "#src/webhook/record-attempt/post-delivery.policy.js";
import { TrackEndpointHealthLive } from "#src/webhook/record-outcome/track-endpoint-health.policy.js";
import { StartDeliveriesLive } from "#src/webhook/start-delivery/start-deliveries.policy.js";

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
