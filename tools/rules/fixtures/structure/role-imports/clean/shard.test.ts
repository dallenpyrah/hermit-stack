import { MachineTest } from "@typeonce/effect-machine/testing";

import { Shard } from "./shard.machine.ts";

export const explored = MachineTest.explore(Shard, {});
