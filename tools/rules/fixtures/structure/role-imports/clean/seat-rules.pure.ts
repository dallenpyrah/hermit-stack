type Stats = import("node:fs").Stats;

export const rules = (stats: Stats) => [stats, import("./plan.schema.ts")];
