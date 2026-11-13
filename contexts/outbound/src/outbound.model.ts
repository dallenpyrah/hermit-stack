import { Model } from "@alchemy.run/domain";

import { Feed } from "#src/feed/feed.aggregate.js";
import { PublicEvents, WritePublicEvents } from "#src/feed/public-events.projection.js";
import { Inbox } from "#src/notification/inbox.view.js";
import { NotifyAudience } from "#src/notification/notify/notify-audience.policy.js";
import { Recipient } from "#src/notification/recipient.aggregate.js";
import { DispatchNotification } from "#src/notification/record-delivery/dispatch-notification.policy.js";
import { ScheduleRetry } from "#src/webhook/attempt-delivery/schedule-retry.policy.js";
import { Delivery } from "#src/webhook/delivery.aggregate.js";
import { Endpoints } from "#src/webhook/endpoints.aggregate.js";
import { PostDelivery } from "#src/webhook/record-attempt/post-delivery.policy.js";
import { TrackEndpointHealth } from "#src/webhook/record-outcome/track-endpoint-health.policy.js";
import { StartDeliveries } from "#src/webhook/start-delivery/start-deliveries.policy.js";

// One context for telling the outside world: every public event fans out from the feed to webhook deliveries and
// Notifications, so the fan-out is a policy inside one model and not wiring between two.
class Outbound extends Model(
  "Outbound",
  {
    aggregates: [Feed, Recipient, Endpoints, Delivery],
    policies: [NotifyAudience, DispatchNotification, StartDeliveries, PostDelivery, ScheduleRetry, TrackEndpointHealth],
    projections: [WritePublicEvents],
    streams: [PublicEvents],
    views: [Inbox],
  },
  { description: "Public events, notifications and outbound webhooks." },
) {}

export { Outbound };
