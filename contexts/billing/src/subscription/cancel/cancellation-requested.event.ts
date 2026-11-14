import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class CancellationRequested extends Event("CancellationRequested", { subscription: Schema.String }) {}

export { CancellationRequested };
