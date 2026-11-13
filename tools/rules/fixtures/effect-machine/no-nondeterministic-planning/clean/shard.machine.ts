import { Machine } from "@typeonce/effect-machine";

export const Shard = Machine.make({}).handle({
  states: {
    Unowned: { on: { Assign: { data: ({ event }) => ({ assignedAt: new Date(event.timestamp) }), target: "Serving" } } },
  },
});
