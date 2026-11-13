import { Schema } from "effect";

export class RoomFull extends Schema.TaggedError<RoomFull>()("RoomFull", {
  roomId: Schema.String,
}) {}
