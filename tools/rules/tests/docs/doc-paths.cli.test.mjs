import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const root = path.resolve(import.meta.dirname, "../..");
const cli = path.join(root, "src", "docs", "doc-paths.cli.mjs");
const run = promisify(execFile);
const failures = [];
const expect = (holds, message) => {
  if (!holds) {
    failures.push(message);
  }
};

const repo = mkdtempSync(path.join(tmpdir(), "doc-paths-"));
const write = (file, text) => {
  mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  writeFileSync(path.join(repo, file), text);
};
const tick = String.fromCodePoint(96);
const code = (text) => tick + text + tick;
const fence = tick.repeat(3);

write("packages/clock/src/clock.pure.ts", "export const now = 0;\n");
write("packages/clock/package.json", JSON.stringify({ exports: { "./clock": "./src/clock.pure.ts" }, name: "clock" }));
write("vendor/upstream/README.md", ["Upstream keeps " + code("packages/core/src") + "."].join("\n"));
write(
  "packages/clock/README.md",
  [
    "The clock is " + code("src/clock.pure.ts") + " and its export is " + code("./clock") + ".",
    "A user's entry is " + code("<app>/src/app.layer.ts") + ", see " + code("https://example.com/a/b") + ".",
    "Hooks live in " + code(".git/hooks") + " and the sibling repo is " + code("../../../rules") + ".",
    fence,
    "packages/clock/src/gone.pure.ts",
    code("packages/clock/src/fenced.pure.ts"),
    fence,
    "Its test was " + code("src/clock.test.ts") + ".",
  ].join("\n"),
);
write(
  "docs/clock.md",
  "Read " + code("packages/clock/src/clock.pure.ts") + " and " + code("packages/clock/src/moved.pure.ts") + ".\n",
);
execFileSync("git", ["init", "-q"], { cwd: repo });

const outcome = (args) =>
  run("node", [cli, ...args], { cwd: repo }).then(
    ({ stderr, stdout }) => ({ code: 0, output: stdout + stderr }),
    (error) => ({ code: error.code, output: String(error.stdout) + String(error.stderr) }),
  );

const stale = await outcome(["--ignore", "vendor/"]);
expect(stale.code === 1, "a doc naming a missing path passes:\n" + stale.output);
expect(
  stale.output.includes("2 paths named in Markdown do not exist") &&
    stale.output.includes("docs/clock.md:1  packages/clock/src/moved.pure.ts does not exist") &&
    stale.output.includes("packages/clock/README.md:8  src/clock.test.ts does not exist"),
  "the failure does not name each missing path with its doc and line:\n" + stale.output,
);
expect(!stale.output.includes("src/clock.pure.ts does not exist"), "a path that exists is reported:\n" + stale.output);
for (const skipped of [
  "./clock",
  "<app>/src/app.layer.ts",
  "https://example.com/a/b",
  ".git/hooks",
  "../../../rules",
  "packages/clock/src/gone.pure.ts",
  "packages/clock/src/fenced.pure.ts",
  "packages/core/src",
]) {
  expect(!stale.output.includes(skipped + " does not exist"), skipped + " is checked:\n" + stale.output);
}

const vendored = await outcome([]);
expect(
  vendored.output.includes("vendor/upstream/README.md:1  packages/core/src does not exist"),
  "a doc outside --ignore is not checked:\n" + vendored.output,
);

write("docs/clock.md", "Read " + code("packages/clock/src/clock.pure.ts") + ".\n");
write("packages/clock/README.md", "The clock is " + code("src/clock.pure.ts") + ".\n");
const fixed = await outcome(["--ignore", "vendor/"]);
expect(
  fixed.code === 0 && fixed.output.includes("doc-paths: every path named in backticks in 2 Markdown files exists"),
  "docs whose paths all exist fail:\n" + fixed.output,
);

for (const failure of failures) {
  console.error("FAIL " + failure);
}
if (failures.length > 0) {
  process.exit(1);
}
console.log(
  "doc-paths: a missing path fails with its doc and line, and fenced code, URLs, placeholders, package exports, generated folders, paths outside the repo and ignored folders are skipped",
);
