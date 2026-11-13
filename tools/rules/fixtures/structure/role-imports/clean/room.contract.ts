import { Schema } from "effect";

import { RoomId } from "./room.schema.ts";

export const Join = Schema.Struct({ room: RoomId });
