import { Layer } from "effect";
import { BunHttpClient } from "@effect/platform-bun";

import { Rooms } from "./rooms.service.ts";

export const AppLayer = Layer.mergeAll(Rooms.layer, BunHttpClient.layer);
