#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { verdictsOf } from "./file-fence.pure.mjs";

// The files to check, as lefthook passes {staged_files}. A staged deletion names a file that no longer exists.
const files = process.argv
  .slice(2)
  .filter((file) => existsSync(path.resolve(file)) && statSync(path.resolve(file)).isFile())
  .map((file) => ({ path: file, text: readFileSync(path.resolve(file), "utf8") }));

const verdicts = verdictsOf(files);
for (const verdict of verdicts) {
  console.error(verdict);
}
if (verdicts.length > 0) {
  process.exit(1);
}
console.log(`file-fence: ${files.length} files under the line cap with no inline suppressions`);
