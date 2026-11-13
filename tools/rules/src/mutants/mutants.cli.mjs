#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { baselineOf, staleBaselineOf, summaryOf, verdictsOf } from "./mutants.pure.mjs";

const root = process.cwd();
const all = process.argv.includes("--all");
const reportFile = path.join(root, "mutants.out", "outcomes.json");
const equivalentsFile = path.join(root, "mutants.equivalent.json");
const baselineFile = path.join(root, "mutants.baseline.json");
const listOf = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {});

if (!existsSync(reportFile)) {
  console.error(
    "mutants: mutants.out/outcomes.json is missing. The check reads the report mutant-cafe writes. Fix: run mutant-cafe in this package first.",
  );
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportFile, "utf8"));
const equivalents = listOf(equivalentsFile);

if (process.argv.includes("--write-baseline")) {
  if (report.failure !== undefined) {
    console.error(
      `mutants: refusing to write a baseline from a failed run: ${String(report.failure).split("\n")[0]}. Fix: make the package's tests pass, then rerun.`,
    );
    process.exit(1);
  }
  const survivors = Object.fromEntries(
    Object.entries(baselineOf(report)).filter(([id]) => !Object.hasOwn(equivalents, id)),
  );
  if (
    report.results.length > 0 &&
    Object.keys(survivors).length === 0 &&
    !process.argv.includes("--allow-empty-baseline")
  ) {
    console.error(
      "mutants: refusing to empty the baseline from a non-empty run. Fix: review the outcomes, then pass --write-baseline --allow-empty-baseline to confirm the empty baseline.",
    );
    process.exit(1);
  }
  const temporary = mkdtempSync(path.join(root, ".mutants-baseline-"));
  try {
    const staged = path.join(temporary, "mutants.baseline.json");
    writeFileSync(staged, `${JSON.stringify(survivors, null, 2)}\n`, { flag: "wx", flush: true });
    renameSync(staged, baselineFile);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  console.log(`mutants: wrote ${Object.keys(survivors).length} surviving mutants to mutants.baseline.json`);
  process.exit(0);
}

const baseline = listOf(baselineFile);
let stale = [];
if (report.failure === undefined && Object.keys(baseline).length > 0) {
  try {
    const enumeration = JSON.parse(
      execFileSync("mutant-cafe", ["--list", "--format", "json"], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
    stale = staleBaselineOf(baseline, enumeration.mutants);
  } catch {
    console.error(
      "mutants: could not enumerate current mutants. Baseline freshness cannot be checked. Fix: run mutant-cafe --list --format json in this package and correct its failure.",
    );
    process.exit(1);
  }
}
const verdicts = stale.length > 0 ? stale : verdictsOf({ all, baseline, equivalents, report });
for (const verdict of verdicts) {
  console.error(verdict);
}
if (verdicts.length > 0) {
  process.exit(1);
}
console.log(
  `mutants: ${summaryOf(report)}; ${Object.keys(equivalents).length} listed as equivalent, ${Object.keys(baseline).length} in the survivor baseline`,
);
