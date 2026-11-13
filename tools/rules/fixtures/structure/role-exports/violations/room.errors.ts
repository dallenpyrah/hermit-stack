import { Schema } from "effect";

export class NotMemberError extends Schema.TaggedErrorClass<NotMemberError>()("NotMemberError", {
  member: Schema.String,
}) {}

export const isNotMember = (error: unknown) => error instanceof NotMemberError;
