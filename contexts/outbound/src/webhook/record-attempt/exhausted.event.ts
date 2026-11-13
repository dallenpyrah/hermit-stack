import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

// The last attempt failed and no retry is left.
class Exhausted extends Event("Exhausted", { attempts: Schema.Int, reason: Schema.String }) {}

export { Exhausted };
