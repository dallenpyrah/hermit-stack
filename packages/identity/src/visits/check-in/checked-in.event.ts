import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

class CheckedIn extends Event("CheckedIn", { name: Schema.String }) {}

export { CheckedIn };
