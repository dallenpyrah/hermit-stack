import { ExternalSystem, Rejection } from "@alchemy.run/domain";
import { Schema } from "effect";

const Undeliverable = Rejection("Undeliverable", { reason: Schema.String });

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
