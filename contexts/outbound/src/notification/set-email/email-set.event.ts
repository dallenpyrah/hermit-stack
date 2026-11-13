import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class EmailSet extends Event("EmailSet", { address: Schema.String }) {}

export { EmailSet };
