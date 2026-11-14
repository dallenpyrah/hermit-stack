import { Schema } from "effect";

const UserId = Schema.NonEmptyString.pipe(Schema.brand("UserId"));

type UserId = typeof UserId.Type;

export { UserId };
