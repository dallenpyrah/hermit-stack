import { Machine } from "@typeonce/effect-machine";

import { Shard } from "./shard.machine.ts";

export const step = Machine.can(Shard);
