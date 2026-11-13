#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";

import { lineCap, overCap } from "../fence/file-fence.pure.mjs";
import { folderCap, layoutOf } from "./layout.pure.mjs";
import {
  inlineSuppressions,
  jsonc,
  knipExceptions,
  measuredCounts,
  mutantEntries,
  oxlintCounts,
  patchedDependencies,
  tsconfigCounts,
  trustPolicyExceptions,
  verdictsOf,
} from "./ratchet.pure.mjs";

const root = process.cwd();
const inRoot = (file) => path.join(root, file);
const textOf = (file) => (existsSync(inRoot(file)) ? readFileSync(inRoot(file), "utf8") : "");
const configOf = async (file) => (await import(pathToFileURL(inRoot(file)).href)).default;

const oxlintFiles = ["oxlint.config.ts", "oxlint-structure.config.ts"].filter((file) => existsSync(inRoot(file)));
const listed = (patterns) =>
  execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...patterns], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\0")
    .filter((file) => file !== "" && existsSync(inRoot(file)));

const sources = listed(["*.ts", "*.tsx", "*.mts", "*.cts", "*.js", "*.jsx", "*.mjs", "*.cjs"]);
const layout = layoutOf([...sources, ...listed(["package.json", "*/package.json"])]);

const mutantLists = (name) => listed([name, `**/${name}`]).map((file) => JSON.parse(textOf(file)));

const equivalentLists = mutantLists("mutants.equivalent.json");
const baselineLists = mutantLists("mutants.baseline.json");

const longFiles = overCap(listed(["."]).map((file) => ({ path: file, text: textOf(file) })));
const longKey = `files over ${lineCap} lines`;
const details = { ...layout.details, [longKey]: longFiles.map(({ lines, path: file }) => `${file} (${lines} lines)`) };

const counted = {
  ...(existsSync(inRoot("knip.config.ts"))
    ? { "knip.config.ts exceptions": knipExceptions(await configOf("knip.config.ts")) }
    : {}),
  ...Object.assign(
    {},
    ...(await Promise.all(oxlintFiles.map(async (file) => oxlintCounts(file, await configOf(file))))),
  ),
  ...Object.assign({}, ...listed(["*tsconfig*.json"]).map((file) => tsconfigCounts(file, jsonc(textOf(file))))),
  "inline suppressions": inlineSuppressions(sources.map(textOf)),
  "patched dependencies": patchedDependencies(
    textOf("pnpm-workspace.yaml"),
    JSON.parse(textOf("package.json") || "{}"),
  ),
  ...(equivalentLists.length > 0 ? { "equivalent mutants": mutantEntries(equivalentLists) } : {}),
  ...trustPolicyExceptions(parse(textOf("pnpm-workspace.yaml"))),
  ...(baselineLists.length > 0 ? { "baseline surviving mutants": mutantEntries(baselineLists) } : {}),
  [longKey]: longFiles.length,
  ...layout.counts,
};
const measured = process.argv
  .flatMap((argument, index, argv) => (argument === "--counts" ? [argv[index + 1] ?? ""] : []))
  .map((file) => measuredCounts(file, existsSync(inRoot(file)) ? textOf(file) : undefined, counted));
const errors = measured.flatMap((result) => result.errors);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
const counts = Object.assign(counted, ...measured.map((result) => result.counts));

if (process.argv.includes("--print")) {
  console.log(JSON.stringify(counts, null, 2));
  process.exit(0);
}

const verdicts = verdictsOf(JSON.parse(textOf("ratchets.json") || "{}"), counts);
const layoutLines = (verdict) =>
  Object.entries(details)
    .filter(([key]) => verdict.startsWith(`"${key}" grew`) || verdict.startsWith(`"${key}" is `))
    .flatMap(([, lines]) => lines);
for (const verdict of verdicts) {
  console.error([verdict, ...layoutLines(verdict).map((line) => `  ${line}`)].join("\n"));
}
if (verdicts.length > 0) {
  process.exit(1);
}
const mirrored = Object.entries(layout.counts).filter(([key]) => key.startsWith("tests outside the mirror"));
const crowded = Object.keys(layout.counts).length - mirrored.length;
console.log(
  `ratchet: ${Object.keys(counts).length} counts at their baseline in ratchets.json, including ${mirrored.reduce((total, [, count]) => total + count, 0)} tests outside the mirror and ${crowded} folders over the cap of ${folderCap}`,
);
