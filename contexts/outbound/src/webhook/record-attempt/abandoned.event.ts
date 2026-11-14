import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class Abandoned extends Event("Abandoned", { attempt: Schema.Int }) {}

export { Abandoned };
