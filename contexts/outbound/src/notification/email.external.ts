import { ExternalSystem, Rejection } from "@alchemy.run/domain";
import { Schema } from "effect";

// The vendor will never deliver to this address, such as after a hard bounce; a timeout is a failure, not this.
const Undeliverable = Rejection("Undeliverable", { reason: Schema.String });

// The idempotency key is <eventId>:<userId>:email, so a dispatch that runs twice sends one email with a vendor that
// Honours it.
class Email extends ExternalSystem(
  "Email",
  {
    send: {
      args: { idempotencyKey: Schema.String, subject: Schema.String, text: Schema.String, to: Schema.String },
      error: Undeliverable,
      success: { messageId: Schema.String },
    },
  },
  { description: "The email vendor that sends notification emails." },
) {}

export { Email, Undeliverable };
