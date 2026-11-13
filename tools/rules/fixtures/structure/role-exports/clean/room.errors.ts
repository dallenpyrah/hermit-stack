import { Schema } from "effect";

export class NotMemberError extends Schema.TaggedErrorClass<NotMemberError>()("NotMemberError", {
  member: Schema.String,
}) {}

export class RoomFullError extends Schema.TaggedErrorClass<RoomFullError>()("RoomFullError", {
  capacity: Schema.Number,
}) {}
