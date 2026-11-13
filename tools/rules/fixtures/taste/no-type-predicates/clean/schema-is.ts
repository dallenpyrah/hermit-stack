import { Schema } from "effect";

export const Room = Schema.Struct({ id: Schema.String });
export const isRoom = Schema.is(Room);
