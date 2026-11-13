#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { pinsOf, verdictsOf } from "./runtime-pins.pure.mjs";

const pinFile = path.join(process.cwd(), "mise.toml");
const pins = existsSync(pinFile) ? pinsOf(readFileSync(pinFile, "utf8")) : {};

const seenOf = (name) => {
  const located = spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" }).stdout.trim();
  if (located === "") {
    return undefined;
  }
  const reported = spawnSync(located, ["--version"], { encoding: "utf8" }).stdout.trim();
  return { path: located, version: reported.replace(/^v/u, "") };
};

const seen = Object.fromEntries(Object.keys(pins).map((name) => [name, seenOf(name)]));
const verdicts = verdictsOf(pins, seen);
for (const verdict of verdicts) {
  console.error(verdict);
}
if (verdicts.length > 0) {
  process.exit(1);
}
console.log(
  `runtime-pins: ${Object.entries(seen)
    .map(([name, { path: located, version }]) => `${name} ${version} (${located})`)
    .join(", ")} match mise.toml`,
);
