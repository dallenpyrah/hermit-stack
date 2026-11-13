import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class Delivered extends Event("Delivered", { attempt: Schema.Int }) {}

export { Delivered };
