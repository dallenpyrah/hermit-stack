export const config = {
  initial: { data: {}, target: "Unowned" },
  states: { Draining: { data: ({ state }) => ({ host: state.host }), target: "Unowned" } },
};
