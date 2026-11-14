import { Schema } from "effect";

// The body APNs sends with an error, such as { "reason": "Unregistered", "timestamp": 1500415314455 }; a success has
// No body: https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns
const ApnsError = Schema.Struct({ reason: Schema.String });

// The alert APNs shows, title and body under aps.alert:
// Https://developer.apple.com/documentation/usernotifications/generating-a-remote-notification
const Alert = Schema.Struct({ body: Schema.String, title: Schema.String });

const ApnsPayload = Schema.Struct({ aps: Schema.Struct({ alert: Alert }) });

export { ApnsError, ApnsPayload };
