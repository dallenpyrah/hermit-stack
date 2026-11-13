import { readFileSync } from "node:fs";

export const read = () => readFileSync("seats.json", "utf8");
