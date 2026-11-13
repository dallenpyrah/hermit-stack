import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { verdictsOf } from "../../src/fence/check-scripts.pure.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const cli = path.join(root, "src", "fence", "check-scripts.cli.mjs");
const run = promisify(execFile);
const failures = [];
const expect = (holds, message) => {
  if (!holds) {
    failures.push(message);
  }
};
const form = /^.+\. .+\. Fix: .+\.$/u;

const check = "turbo boundaries && turbo run fmt:check test test:bun knip --continue=dependencies-successful";
const cases = [
  ["the same command with --affected", "pnpm check --affected", []],
  ["pnpm run check --affected", "pnpm run check --affected", []],
  [
    "an explicit list with the same tasks",
    "turbo boundaries && turbo run fmt:check test test:bun knip --affected --continue=dependencies-successful",
    [],
  ],
  [
    "a list without test:bun",
    "turbo boundaries && turbo run fmt:check test knip --affected",
    ["check:affected skips test:bun, which check runs."],
  ],
  [
    "a list with an extra task",
    "turbo boundaries && turbo run fmt:check test test:bun knip build --affected",
    ["check:affected runs build, which check does not."],
  ],
  [
    "a list without turbo boundaries",
    "turbo run fmt:check test test:bun knip --affected",
    ["check:affected skips `turbo boundaries`, which check runs."],
  ],
  ["a reference without --affected", "pnpm check", ["check:affected does not pass --affected to turbo run."]],
];
for (const [label, affected, expected] of cases) {
  const verdicts = verdictsOf({ check, "check:affected": affected });
  expect(
    verdicts.length === expected.length && expected.every((start, index) => verdicts[index].startsWith(start)),
    `${label}: ${JSON.stringify(verdicts)}`,
  );
  for (const verdict of verdicts) {
    expect(form.test(verdict), `${label}: not in <what>. <why>. Fix: <step>. form: ${verdict}`);
  }
}
expect(verdictsOf({ check }).length === 0, "a repo without check:affected fails");

const pinnedCheck =
  "mise exec -- turbo boundaries && mise exec -- turbo run fmt:check test test:bun knip --continue=dependencies-successful";
expect(
  verdictsOf({ check: pinnedCheck, "check:affected": "pnpm check --affected" }).length === 0,
  `a check run through mise exec differs from its own --affected: ${verdictsOf({ check: pinnedCheck, "check:affected": "pnpm check --affected" })}`,
);
expect(
  verdictsOf({
    check: pinnedCheck,
    "check:affected": "mise exec -- turbo boundaries && mise exec -- turbo run fmt:check test knip --affected",
  })[0]?.startsWith("check:affected skips test:bun") === true,
  "a check run through mise exec hides a task check:affected skips",
);

const repo = mkdtempSync(path.join(tmpdir(), "check-scripts-"));
const cliWith = async (scripts) => {
  writeFileSync(path.join(repo, "package.json"), JSON.stringify({ scripts }));
  return run("node", [cli], { cwd: repo }).then(
    () => ({ code: 0, stderr: "" }),
    (error) => ({ code: error.code, stderr: error.stderr }),
  );
};
expect(
  (await cliWith({ check, "check:affected": "pnpm check --affected" })).code === 0,
  "the CLI fails matching scripts",
);
const drifted = await cliWith({
  check,
  "check:affected": "turbo boundaries && turbo run fmt:check test knip --affected",
});
expect(
  drifted.code === 1 && drifted.stderr.includes("skips test:bun"),
  `the CLI passes a drifted check:affected: ${drifted.stderr}`,
);

const { scripts } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
expect(
  verdictsOf(scripts).length === 0,
  `this repo's check:affected differs from check: ${verdictsOf(scripts).join(" ")}`,
);
expect(/\blint:scripts\b/u.test(scripts.check), "pnpm check does not run lint:scripts");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`check-scripts: ${cases.length} check:affected shapes, the CLI, and this repo's scripts`);
