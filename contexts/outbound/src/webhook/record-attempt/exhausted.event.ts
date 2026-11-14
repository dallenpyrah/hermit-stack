import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class Exhausted extends Event("Exhausted", { attempts: Schema.Int, reason: Schema.String }) {}

export { Exhausted };
