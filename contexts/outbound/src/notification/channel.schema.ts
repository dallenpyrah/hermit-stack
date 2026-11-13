import { Schema } from "effect";

// Where a notification goes: the in-app inbox, an email address, or one push device.
const Channel = Schema.Literals(["inbox", "email", "push"]);

type Channel = typeof Channel.Type;

export { Channel };
