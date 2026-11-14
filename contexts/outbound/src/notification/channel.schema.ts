import { Schema } from "effect";

const Channel = Schema.Literals(["inbox", "email", "push"]);

type Channel = typeof Channel.Type;

export { Channel };
