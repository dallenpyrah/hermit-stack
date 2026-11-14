import { Schema } from "effect";

const UserId = Schema.String.pipe(Schema.brand("UserId"));

type UserId = typeof UserId.Type;

export { UserId };
