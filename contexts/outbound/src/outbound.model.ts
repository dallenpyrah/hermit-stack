import { Model } from "@alchemy.run/domain";

import { Feed } from "#src/feed/feed.aggregate.js";
import { PublicEvents, WritePublicEvents } from "#src/feed/public-events.projection.js";
import { Inbox } from "#src/notification/inbox.view.js";
import { DispatchNotification, NotifyAudience } from "#src/notification/notification.policy.js";
import { Recipient } from "#src/notification/recipient.aggregate.js";
import { Delivery } from "#src/webhook/delivery.aggregate.js";
import { PostDelivery, ScheduleRetry, StartDeliveries, TrackEndpointHealth } from "#src/webhook/delivery.policy.js";
import { Endpoints } from "#src/webhook/endpoints.aggregate.js";

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
