import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

// The customer asked to stop. They keep what they paid for until the processor reports the subscription ended.
class CancellationRequested extends Event("CancellationRequested", { subscription: Schema.String }) {}

export { CancellationRequested };
