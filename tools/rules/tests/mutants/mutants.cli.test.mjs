import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const cli = path.resolve(import.meta.dirname, "..", "..", "src", "mutants", "mutants.cli.mjs");
const run = promisify(execFile);
const failures = [];
const expect = (holds, message) => {
  if (!holds) {
    failures.push(message);
  }
};
const packageRoot = "/repo/packages/core";
const mutant = (id, line) => ({
  description: `replace pick${line} -> boolean with true`,
  file: `${packageRoot}/src/pick.ts`,
  id,
  span: { end: { column: 9, line }, start: { column: 3, line } },
});
const result = (id, line, outcome) => ({ mutant: mutant(id, line), outcome });
const report = (results) => ({ results, root: packageRoot });
const reason = { at: "src/pick.ts:1:3", mutant: "replace pick1 with true", reason: "pick1 already returns true" };

const work = mkdtempSync(path.join(tmpdir(), "mutants-"));
const enumerationFile = path.join(work, "enumeration.json");
writeFileSync(enumerationFile, JSON.stringify({ mutants: [mutant("a", 1), mutant("b", 2), mutant("c", 3)] }));
writeFileSync(
  path.join(work, "mutant-cafe"),
  [
    `#!${process.execPath}`,
    'if (process.argv.slice(2).join(" ") !== "--list --format json") process.exit(9);',
    `process.stdout.write(require("node:fs").readFileSync(${JSON.stringify(enumerationFile)}, "utf8"));`,
    "",
  ].join("\n"),
  { mode: 0o755 },
);
const cliIn = async (args) =>
  run(process.execPath, [cli, ...args], { cwd: work, env: { PATH: work } }).then(
    ({ stdout, stderr }) => ({ code: 0, stderr, stdout }),
    (error) => ({ code: error.code, stderr: error.stderr, stdout: error.stdout }),
  );
const missing = await cliIn([]);
expect(missing.code === 1 && missing.stderr.includes("outcomes.json is missing"), `no report: ${missing.stderr}`);

mkdirSync(path.join(work, "mutants.out"));
const write = (results, equivalents) => {
  writeFileSync(path.join(work, "mutants.out", "outcomes.json"), JSON.stringify({ ...report(results), root: work }));
  writeFileSync(path.join(work, "mutants.equivalent.json"), JSON.stringify(equivalents));
};
write([result("a", 1, "missed"), result("b", 2, "caught")], {});
expect((await cliIn([])).code === 1, "the CLI passes a missed mutant");
write([result("a", 1, "missed"), result("b", 2, "caught")], { a: reason });
const passed = await cliIn(["--all"]);
expect(
  passed.code === 0 && passed.stdout.includes("1 caught, 1 missed") && passed.stdout.includes("1 listed as equivalent"),
  `the CLI fails a listed equivalent: ${passed.stderr}${passed.stdout}`,
);
write([result("b", 2, "caught")], { a: reason });
expect((await cliIn(["--all"])).code === 1, "the CLI keeps an entry a full run no longer generates");
expect((await cliIn([])).code === 0, "the CLI rejects an entry a diff run did not select");

write([result("a", 1, "missed"), result("c", 3, "missed")], { a: reason });
const written = await cliIn(["--write-baseline"]);
const baselineFile = JSON.parse(readFileSync(path.join(work, "mutants.baseline.json"), "utf8"));
expect(
  written.code === 0 && JSON.stringify(Object.keys(baselineFile)) === JSON.stringify(["c"]),
  `--write-baseline lists survivors that are not equivalent: ${JSON.stringify(baselineFile)}`,
);
const withBaseline = await cliIn(["--all"]);
expect(
  withBaseline.code === 0 && withBaseline.stdout.includes("1 in the survivor baseline"),
  `baseline run: ${withBaseline.stderr}`,
);
write([result("a", 1, "missed"), result("c", 3, "missed"), result("d", 4, "missed")], { a: reason });
expect((await cliIn(["--all"])).code === 1, "the CLI passes a survivor that is not in the baseline");

write([result("b", 2, "caught")], {});
expect((await cliIn([])).code === 0, "a diff run rejects a currently generated baseline id it did not select");
writeFileSync(path.join(work, "mutants.baseline.json"), JSON.stringify({ ...baselineFile, stale: baselineFile.c }));
const stale = await cliIn([]);
expect(
  stale.code === 1 &&
    stale.stderr.includes("mutants.baseline.json lists stale, which current sources no longer generate."),
  `a diff run keeps a baseline id absent from complete enumeration: ${stale.stderr}`,
);
writeFileSync(path.join(work, "mutants.baseline.json"), JSON.stringify(baselineFile));
writeFileSync(enumerationFile, "invalid JSON");
const invalid = await cliIn([]);
expect(
  invalid.code === 1 && invalid.stderr.includes("could not enumerate current mutants"),
  `invalid enumeration fails open: ${invalid.stderr}`,
);
for (const malformed of [
  {},
  { mutants: null },
  { mutants: "invalid" },
  { mutants: [{ id: "c" }, {}] },
  { mutants: [{ id: "c" }, { id: 7 }] },
  { mutants: [{ id: "c" }, { id: "" }] },
]) {
  writeFileSync(enumerationFile, JSON.stringify(malformed));
  expect((await cliIn([])).code === 1, "malformed enumeration fails open");
}
writeFileSync(path.join(work, "mutant-cafe"), `#!${process.execPath}\nprocess.exit(7);\n`);
expect((await cliIn([])).code === 1, "failed enumeration fails open");
writeFileSync(path.join(work, "mutants.baseline.json"), "{}");
expect((await cliIn([])).code === 0, "an empty baseline requires enumeration");

const baselinePath = path.join(work, "mutants.baseline.json");
const preserved = `${JSON.stringify(baselineFile, null, 4)}\n\n`;
for (const failure of ["BaselineFailed: controlled failing baseline", "TimedOut: controlled timeout", "", null]) {
  writeFileSync(baselinePath, preserved);
  writeFileSync(path.join(work, "mutants.out", "outcomes.json"), JSON.stringify({ ...report([]), failure }));
  const refused = await cliIn(["--write-baseline", "--allow-empty-baseline"]);
  expect(refused.code === 1 && refused.stderr.includes("refusing to write"), "a failed run writes a baseline");
  expect(readFileSync(baselinePath, "utf8") === preserved, "a failed run changes the baseline bytes");
}
rmSync(baselinePath);
expect((await cliIn(["--write-baseline"])).code === 1 && !existsSync(baselinePath), "a failed run creates a baseline");

for (const [results, equivalents] of [
  [[result("b", 2, "caught")], {}],
  [[result("a", 1, "missed")], { a: reason }],
]) {
  writeFileSync(baselinePath, preserved);
  write(results, equivalents);
  const empty = await cliIn(["--write-baseline"]);
  expect(
    empty.code === 1 && empty.stderr.includes("--allow-empty-baseline"),
    "a non-empty run silently empties the baseline",
  );
  expect(readFileSync(baselinePath, "utf8") === preserved, "a refused empty baseline changes the old bytes");
  expect(
    (await cliIn(["--write-baseline", "--allow-empty-baseline"])).code === 0,
    "explicit empty baseline is refused",
  );
  expect(readFileSync(baselinePath, "utf8") === "{}\n", "explicit empty baseline is not written");
}
write([], {});
expect((await cliIn(["--write-baseline"])).code === 0, "an empty run cannot write an empty baseline");

const preload = path.join(work, "interrupt-write.cjs");
writeFileSync(
  preload,
  [
    'const fs = require("node:fs");',
    'const { syncBuiltinESMExports } = require("node:module");',
    "const write = fs.writeFileSync;",
    'fs.writeFileSync = (file, data, options) => { write(file, String(data).slice(0, 5), options); process.kill(process.pid, "SIGKILL"); };',
    "syncBuiltinESMExports();",
  ].join("\n"),
);
write([result("c", 3, "missed")], {});
writeFileSync(baselinePath, preserved);
const interrupted = await run(process.execPath, ["--require", preload, cli, "--write-baseline"], { cwd: work }).then(
  () => ({ signal: undefined }),
  (error) => ({ signal: error.signal }),
);
expect(interrupted.signal === "SIGKILL", "the interrupted-write control did not kill the writer");
expect(readFileSync(baselinePath, "utf8") === preserved, "an interrupted write corrupts the old baseline");
for (const name of readdirSync(work).filter((name) => name.startsWith(".mutants-baseline-"))) {
  rmSync(path.join(work, name), { recursive: true });
}
writeFileSync(
  preload,
  [
    'const fs = require("node:fs");',
    'const { syncBuiltinESMExports } = require("node:module");',
    'fs.renameSync = () => { throw new Error("controlled rename failure"); };',
    "syncBuiltinESMExports();",
  ].join("\n"),
);
const renameFailed = await run(process.execPath, ["--require", preload, cli, "--write-baseline"], { cwd: work }).then(
  () => ({ code: 0, stderr: "" }),
  (error) => ({ code: error.code, stderr: error.stderr }),
);
expect(renameFailed.code === 1 && renameFailed.stderr.includes("controlled rename failure"), "rename failure passes");
expect(readFileSync(baselinePath, "utf8") === preserved, "failed publication changes the old baseline");
expect(
  !readdirSync(work).some((name) => name.startsWith(".mutants-baseline-")),
  "failed publication leaves temporary files",
);
const published = await cliIn(["--write-baseline"]);
expect(
  published.code === 0 && published.stdout.includes("wrote 1 surviving mutants"),
  "a successful baseline is not published",
);
expect(
  JSON.stringify(JSON.parse(readFileSync(baselinePath, "utf8"))) === JSON.stringify(baselineFile),
  "published baseline differs",
);
expect(
  !readdirSync(work).some((name) => name.startsWith(".mutants-baseline-")),
  "successful publication leaves temporary files",
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  "mutants.cli: a missing report, equivalents, --all, --write-baseline and a survivor outside the baseline on a fixture report",
);
