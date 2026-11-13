import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { catalogOf, pinOf, repositoryUrlOf, tagCandidates } from "../../src/agent-sources/agent-sources.pure.mjs";

const root = path.resolve(import.meta.dirname, "../..");
// The repo's own wiring lives at the monorepo root, two folders up from this package.
const workspaceRoot = path.resolve(root, "../..");
const cli = path.join(root, "src", "agent-sources", "agent-sources.cli.mjs");
const run = promisify(execFile);
const failures = [];
const expect = (holds, message) => {
  if (!holds) {
    failures.push(message);
  }
};
const same = (actual, expected, message) =>
  expect(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)}`);

same(
  catalogOf(
    'packages: []\ncatalog:\n  "@scope/a": "1.2.3"\n  b: 4.5.6\n  # comment\n  c: "file:vendor/c.tgz"\nsaveExact: true\n',
  ),
  { "@scope/a": "1.2.3", b: "4.5.6", c: "file:vendor/c.tgz" },
  "catalog entries",
);
same(pinOf("a", { a: "1.0.0" }, { devDependencies: { a: "catalog:" } }), "1.0.0", "a catalog pin");
same(pinOf("a", {}, { devDependencies: { a: "2.0.0" } }), "2.0.0", "a package.json pin");
same(repositoryUrlOf({ url: "git+https://github.com/o/r.git" }), "https://github.com/o/r.git", "git+ prefix");
same(repositoryUrlOf("github:o/r"), "https://github.com/o/r.git", "github shorthand");
same(tagCandidates("@s/p", "1.0.0"), ["@s/p@1.0.0", "v1.0.0", "1.0.0"], "tag candidates");

const scratch = mkdtempSync(path.join(tmpdir(), "agent-sources-"));
const upstream = path.join(scratch, "upstream");
const sh = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
mkdirSync(upstream);
sh(["init", "-q"], upstream);
sh(["config", "uploadpack.allowAnySHA1InWant", "true"], upstream);
const commit = (text, tag) => {
  writeFileSync(path.join(upstream, "source.txt"), text);
  sh(["add", "source.txt"], upstream);
  sh(["-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "commit", "-q", "-m", text], upstream);
  sh(["tag", tag], upstream);
  return sh(["rev-parse", "HEAD"], upstream);
};
const first = commit("v1", "fake@1.0.0");
const second = commit("v2", "v2.0.0");

const repo = path.join(scratch, "repo");
mkdirSync(path.join(repo, "node_modules", "fake"), { recursive: true });
mkdirSync(path.join(repo, "vendor", "package"), { recursive: true });
const repository = { url: `git+file://${upstream}` };
writeFileSync(path.join(repo, "node_modules", "fake", "package.json"), JSON.stringify({ name: "fake", repository }));
writeFileSync(
  path.join(repo, "vendor", "package", "package.json"),
  JSON.stringify({ name: "fake", repository, version: "2.0.0" }),
);
execFileSync("tar", ["-czf", "fake.tgz", "package"], { cwd: path.join(repo, "vendor") });
writeFileSync(path.join(repo, "package.json"), JSON.stringify({ devDependencies: { fake: "catalog:" } }));
writeFileSync(
  path.join(repo, "agent-sources.json"),
  JSON.stringify({ fake: { package: "fake" }, pinned: { package: "fake", ref: second } }),
);
const pin = (value) =>
  writeFileSync(path.join(repo, "pnpm-workspace.yaml"), `packages: []\ncatalog:\n  fake: "${value}"\n`);
const cliIn = async () =>
  run("node", [cli], { cwd: repo }).then(
    ({ stdout, stderr }) => ({ code: 0, output: stdout + stderr }),
    (error) => ({ code: error.code, output: `${error.stdout}${error.stderr}` }),
  );
const headOf = (name) => sh(["rev-parse", "HEAD"], path.join(repo, ".agent_sources", name));
const textOf = (name) => readFileSync(path.join(repo, ".agent_sources", name, "source.txt"), "utf8");

pin("1.0.0");
const cloned = await cliIn();
expect(cloned.code === 0, `the first run fails: ${cloned.output}`);
expect(headOf("fake") === first && textOf("fake") === "v1", "pin 1.0.0 does not clone tag fake@1.0.0");
expect(headOf("pinned") === second, "an entry with ref does not clone that commit");

const again = await cliIn();
expect(again.output.includes("fake: fake 1.0.0 is up to date"), `a second run reclones: ${again.output}`);

pin("2.0.0");
const moved = await cliIn();
expect(
  moved.code === 0 && headOf("fake") === second && textOf("fake") === "v2",
  `changing the pin to 2.0.0 does not update the clone: ${moved.output}`,
);

pin("file:vendor/fake.tgz");
writeFileSync(path.join(repo, "agent-sources.json"), JSON.stringify({ fake: { package: "fake" } }));
const vendored = await cliIn();
expect(
  vendored.code === 0 && headOf("fake") === second,
  `a file: tarball pin does not clone its version: ${vendored.output}`,
);

pin("3.0.0");
const missing = await cliIn();
expect(
  missing.code === 1 && missing.output.includes("has no tag for fake 3.0.0 (tried fake@3.0.0, v3.0.0, 3.0.0)"),
  `a pin with no tag passes: ${missing.output}`,
);

const agents = readFileSync(path.join(workspaceRoot, "AGENTS.md"), "utf8");
expect(
  agents.includes(".agent_sources/") && agents.includes("node_modules/effect/AGENTS.md"),
  "AGENTS.md does not point at .agent_sources/ and node_modules/effect/AGENTS.md",
);
expect(
  readFileSync(path.join(workspaceRoot, ".gitignore"), "utf8").split("\n").includes(".agent_sources/"),
  ".gitignore does not ignore .agent_sources/",
);
expect(
  Object.keys(JSON.parse(readFileSync(path.join(workspaceRoot, "agent-sources.json"), "utf8"))).length > 0,
  "agent-sources.json lists nothing",
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  "agent-sources: catalog and tag parsing, clone by tag and by ref, a pin change, a tarball pin, a missing tag, and this repo's wiring",
);
