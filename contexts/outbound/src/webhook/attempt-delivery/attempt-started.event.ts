import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class AttemptStarted extends Event("AttemptStarted", { attempt: Schema.Int }) {}

export { AttemptStarted };
