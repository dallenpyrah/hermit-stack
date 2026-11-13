import { Schema } from "effect";

// A recipient is the user it notifies, so a public event's audience addresses recipients directly.
const UserId = Schema.String.pipe(Schema.brand("UserId"));

type UserId = typeof UserId.Type;

export { UserId };
