#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

import { verdictsOf } from "./check-scripts.pure.mjs";

const { scripts = {} } = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
const verdicts = verdictsOf(scripts);
for (const verdict of verdicts) {
  console.error(verdict);
}
if (verdicts.length > 0) {
  process.exit(1);
}
console.log("check-scripts: check:affected runs the same tasks as check");
