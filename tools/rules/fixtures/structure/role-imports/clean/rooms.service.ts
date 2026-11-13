import { Effect } from "effect";

import { RoomStore } from "./room-store.adapter.ts";
import { seatPrice } from "./seat-price.pure.ts";

export const rooms = Effect.succeed([RoomStore, seatPrice]);
