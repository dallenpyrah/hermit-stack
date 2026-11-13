#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const usage = "usage: rules-env [--schema <.env.schema>] [--ignore <glob>]...";
const args = process.argv.slice(2);
const ignored = [];
let schema = ".env.schema";
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--ignore") {
    ignored.push(args[(index += 1)]);
  } else if (args[index] === "--schema") {
    schema = args[(index += 1)];
  } else {
    console.error(usage);
    process.exit(1);
  }
}

const providedByTheSystem = new Set(["HOME", "PATH"]);
const importPattern = /@import\(\s*["'`]?([^"'`)\s]+)/gu;
const itemPattern = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/u;
const declaredIn = (file, seen) => {
  const resolved = path.resolve(file);
  if (seen.has(resolved)) {
    return [];
  }
  seen.add(resolved);
  const lines = readFileSync(resolved, "utf8").split("\n");
  const imported = lines
    .filter((line) => line.trimStart().startsWith("#"))
    .flatMap((line) => [...line.matchAll(importPattern)].map((match) => match[1]))
    .flatMap((target) => declaredIn(path.resolve(path.dirname(resolved), target), seen));
  const items = lines.flatMap((line) => {
    const match = itemPattern.exec(line.trim());
    return match === null ? [] : [match[1]];
  });
  return [...imported, ...items];
};
const declared = new Set(declaredIn(schema, new Set()));

const readPatterns = [
  /(?:process|Bun)\.env\.([A-Za-z_][A-Za-z0-9_]*)/gu,
  /import\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/gu,
  /(?:process|Bun)\.env\[\s*["'`]([A-Za-z_][A-Za-z0-9_]*)["'`]\s*\]/gu,
];
const dynamicRead = /(?:process|Bun)\.env\[\s*(?!["'`][A-Za-z_][A-Za-z0-9_]*["'`]\s*\])/u;
const destructured = /\{([^}]*)\}\s*=\s*(?:process|Bun)\.env\b/u;
const skipped = /(^|\/)(node_modules|dist|fixtures)(\/|$)/u;
const files = execFileSync(
  "git",
  ["ls-files", "-co", "--exclude-standard", "--", "*.ts", "*.tsx", "*.mts", "*.cts", "*.js", "*.mjs", "*.cjs"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter((file) => file !== "" && !skipped.test(file) && !ignored.some((glob) => path.matchesGlob(file, glob)));

const problems = files.flatMap((file) =>
  readFileSync(file, "utf8")
    .split("\n")
    .flatMap((line, index) => {
      const at = `${file}:${index + 1}`;
      const destructuredNames = (destructured.exec(line)?.[1] ?? "")
        .split(",")
        .map((part) => part.split(":")[0].split("=")[0].trim())
        .filter((name) => name !== "");
      const names = [
        ...readPatterns.flatMap((pattern) => [...line.matchAll(pattern)].map((match) => match[1])),
        ...destructuredNames,
      ];
      const undeclared = names
        .filter((name) => !declared.has(name) && !providedByTheSystem.has(name))
        .map((name) => `${at}: reads ${name}, which ${schema} does not declare`);
      return dynamicRead.test(line)
        ? [...undeclared, `${at}: reads process.env by a computed name; read each variable by its literal name`]
        : undeclared;
    }),
);

if (problems.length > 0) {
  console.error([...new Set(problems)].join("\n"));
  console.error(
    `rules-env: ${problems.length} environment read(s) the schema does not cover. Declare each in ${schema}.`,
  );
  process.exit(1);
}
console.log(`rules-env: ${files.length} files, every environment read is declared in ${schema}`);
