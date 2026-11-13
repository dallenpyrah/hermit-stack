import { Schema } from "effect";

export class RoomFullError extends Schema.TaggedError<RoomFullError>()("RoomFullError", {
  roomId: Schema.String,
}) {}
