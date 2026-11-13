import type { Stats } from "node:fs";
import { Array as Arr } from "effect";

import type { RoomLog } from "./room-log.service.ts";
import { Plan } from "./plan.schema.ts";

export const price = (stats: Stats, log: RoomLog) => [Arr.length([stats, log]), Plan];
