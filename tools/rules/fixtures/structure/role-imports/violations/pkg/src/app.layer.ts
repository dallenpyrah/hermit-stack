import { Layer } from "effect";

import { roomsFake } from "#tests/rooms.fake";

export const appLayer = Layer.mergeAll(roomsFake);
