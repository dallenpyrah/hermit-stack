import { Schema } from "effect";

// The auth adapter assigns a user's id and the domain only compares it, so changing vendor never changes what an id means.
const UserId = Schema.NonEmptyString.pipe(Schema.brand("UserId"));

type UserId = typeof UserId.Type;

export { UserId };
