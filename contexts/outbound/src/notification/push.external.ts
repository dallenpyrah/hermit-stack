import { ExternalSystem, Rejection } from "@alchemy.run/domain";
import { Schema } from "effect";

const DeviceGone = Rejection("DeviceGone", { reason: Schema.String });

class Push extends ExternalSystem(
  "Push",
  {
    send: {
      args: { body: Schema.String, idempotencyKey: Schema.String, title: Schema.String, token: Schema.String },
      error: DeviceGone,
      success: { messageId: Schema.String },
    },
  },
  { description: "The push vendor that sends notifications to devices." },
) {}

export { DeviceGone, Push };
