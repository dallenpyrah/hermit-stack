import { it } from "@effect/vitest";
import { Effect } from "effect";

import { roomsFake } from "#tests/rooms.fake";
import { Rooms } from "#src/host/rooms.service";

it.effect("lists rooms", () => Effect.provide(Rooms.list, roomsFake));
