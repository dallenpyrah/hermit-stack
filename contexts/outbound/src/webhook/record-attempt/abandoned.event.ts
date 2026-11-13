import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

// The receiver answered 410 Gone, so the delivery stops and its endpoint is disabled.
class Abandoned extends Event("Abandoned", { attempt: Schema.Int }) {}

export { Abandoned };
