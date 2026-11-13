import { Event } from "@alchemy.run/domain";
import { Schema } from "effect";

// The name comes from the session, not the command, so it is the name the signed-in user has now.
class CheckedIn extends Event("CheckedIn", { name: Schema.String }) {}

export { CheckedIn };
