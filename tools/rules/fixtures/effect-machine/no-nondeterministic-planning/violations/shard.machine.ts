import { Machine } from "@typeonce/effect-machine";

export const Shard = Machine.make({}).handle({
  states: { Unowned: { on: { Assign: { data: () => ({ assignedAt: Date.now() }), target: "Serving" } } } },
});
