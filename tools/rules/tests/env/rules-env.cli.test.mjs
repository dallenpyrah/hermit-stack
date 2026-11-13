import { execFile } from "node:child_process";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const root = path.resolve(import.meta.dirname, "../..");
const run = promisify(execFile);
const rulesEnv = path.join(root, "src", "env", "rules-env.cli.mjs");
const outcome = (promise) =>
  promise.then(
    ({ stdout, stderr }) => ({ code: 0, output: `${stdout}${stderr}` }),
    (error) => ({ code: error.code, output: `${error.stdout}${error.stderr}` }),
  );
const failures = [];
const expect = (holds, message) => {
  if (!holds) {
    failures.push(message);
  }
};
const scratch = mkdtempSync(path.join(tmpdir(), "rules-env-"));

const repo = path.join(scratch, "repo");
const fixtures = path.join(root, "fixtures", "env");
cpSync(path.join(fixtures, ".env.schema"), path.join(repo, ".env.schema"));
cpSync(path.join(fixtures, "shared"), path.join(repo, "shared"), { recursive: true });
await run("git", ["init", "-q"], { cwd: repo });
cpSync(path.join(fixtures, "undeclared.mjs"), path.join(repo, "app.mjs"));
const undeclared = await outcome(run(process.execPath, [rulesEnv], { cwd: repo }));
expect(undeclared.code === 1, "rules-env passed an undeclared read");
expect(undeclared.output.includes("app.mjs:2: reads MISSING"), `rules-env did not name MISSING:\n${undeclared.output}`);
expect(
  undeclared.output.includes("app.mjs:4: reads process.env by a computed name"),
  `rules-env missed the computed read:\n${undeclared.output}`,
);
expect(!/reads LOCAL\b/u.test(undeclared.output), `rules-env flagged a declared read:\n${undeclared.output}`);
cpSync(path.join(fixtures, "declared.mjs"), path.join(repo, "app.mjs"));
const declared = await outcome(run(process.execPath, [rulesEnv], { cwd: repo }));
expect(
  declared.code === 0,
  `rules-env failed with every read declared, imported and system variables included:\n${declared.output}`,
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("env schema: rules-env catches undeclared reads");
