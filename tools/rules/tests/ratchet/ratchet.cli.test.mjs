import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

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
} from "../../src/ratchet/ratchet.pure.mjs";
import { layoutOf } from "../../src/ratchet/layout.pure.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const workspaceRoot = path.resolve(root, "../..");
const cli = path.join(root, "src", "ratchet", "ratchet.cli.mjs");
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
  oxlintCounts("oxlint.config.ts", {
    ignorePatterns: ["**/dist/**", "test/**"],
    overrides: [
      { files: ["a/**", "b/**"], rules: { "eslint/no-console": "off", "import/no-default-export": "off" } },
      { env: { browser: true }, files: ["c/**"] },
    ],
    rules: { "eslint/max-lines": ["error", { max: 500 }], "eslint/no-plusplus": "off", "unicorn/no-null": ["off"] },
  }),
  {
    "oxlint.config.ts rules off": 2,
    "oxlint.config.ts override rules per glob": 4,
    "oxlint.config.ts ignore patterns": 2,
  },
  "oxlint counts",
);
same(
  oxlintCounts("oxlint-structure.config.ts", {
    rules: {
      "structure/role-imports": [
        "error",
        { definitionServices: ["@akterjs/effect/contract"], packages: ["@akterjs/"] },
      ],
    },
  }),
  {
    "oxlint-structure.config.ts role-imports definition services": 1,
    "oxlint-structure.config.ts rules off": 0,
    "oxlint-structure.config.ts override rules per glob": 0,
    "oxlint-structure.config.ts ignore patterns": 0,
  },
  "role-imports definition services count as exceptions",
);
same(
  knipExceptions({
    entry: ["a.ts", "b.ts"],
    ignoreBinaries: ["mise"],
    ignoreIssues: { "vendor/**": ["exports", "types"] },
    workspaces: { infra: { ignoreDependencies: ["alchemy", "effect"] }, web: { project: ["src/**"] } },
  }),
  7,
  "knip exceptions",
);
same(
  patchedDependencies(
    'packages: []\npatchedDependencies:\n  "a@1": patches/a.patch\n  "b@2": patches/b.patch\nsaveExact: true\n',
    {
      pnpm: { patchedDependencies: { "c@3": "patches/c.patch" } },
    },
  ),
  3,
  "patched dependencies",
);
same(patchedDependencies("packages: []\n", {}), 0, "no patched dependencies");
same(trustPolicyExceptions({ trustPolicy: "no-downgrade" }), {}, "no trust policy exceptions");
same(
  trustPolicyExceptions({ trustPolicyExclude: ["a@1", "b@2"] }),
  { "trust policy exceptions": 2 },
  "package selectors count",
);
same(trustPolicyExceptions(undefined), {}, "an absent workspace has no exceptions");
same(
  mutantEntries([{ a: { reason: "same value" }, b: { reason: "unreachable" } }, { c: { reason: "same value" } }, {}]),
  3,
  "mutant list entries",
);
same(
  inlineSuppressions([
    `// ${"oxlint"}-disable-next-line no-console`,
    `// @ts-${"expect-error"}\n// @ts-${"ignore"}`,
    "const x = 1;",
  ]),
  3,
  "inline suppressions",
);

same(
  jsonc('{\n  // a "quoted" comment\n  "url": "https://example.com/a//b", /* block */\n  "list": [1, 2,],\n}\n'),
  { url: "https://example.com/a//b", list: [1, 2] },
  "tsconfig text with comments and trailing commas",
);
same(
  tsconfigCounts("packages/a/tsconfig.json", {
    compilerOptions: {
      allowUnreachableCode: true,
      noUnusedLocals: false,
      plugins: [
        { name: "next" },
        {
          allowedUnstableApis: ["effect/sql", "effect/http"],
          diagnosticSeverity: { apiStabilityLeak: "off", floatingEffect: "error", nodeBuiltinImport: "suggestion" },
          ignoreEffectWarningsInTscExitCode: true,
          name: "@effect/language-service",
          overrides: [
            {
              include: ["src/a.ts", "src/b.ts"],
              options: { diagnosticSeverity: { apiStabilityLeak: "off", x: "message" } },
            },
            { include: ["src/c.ts"], options: { diagnosticSeverity: { strictEffectProvide: "warning" } } },
          ],
        },
      ],
      strict: true,
    },
  }),
  {
    "packages/a/tsconfig.json diagnostics off": 5,
    "packages/a/tsconfig.json override diagnostics per glob": 4,
    "packages/a/tsconfig.json allowed unstable APIs": 2,
  },
  "tsconfig counts",
);
same(
  tsconfigCounts("tsconfig.json", {
    compilerOptions: { plugins: [{ diagnosticSeverity: { a: "error" }, name: "@effect/language-service" }] },
  }),
  {},
  "a tsconfig that turns nothing off",
);

const form =
  /^[^]+\. Ratchets may only go down, so the count in ratchets\.json is the most this repo allows[^]*\. Fix: [^]+\.$/u;
const baseline = { a: 2, b: 2, c: 2, gone: 1 };
const verdicts = verdictsOf(baseline, { a: 2, b: 3, c: 1, new: 4 });
same(verdicts.length, 4, "verdicts for grew, dropped, unlisted and stale counts");
expect(
  verdicts.some((verdict) => verdict.startsWith('"b" grew from 2 to 3.')),
  "a grown count passes",
);
expect(
  verdicts.some((verdict) => verdict.startsWith('"c" dropped from 2 to 1.')),
  "a dropped count passes",
);
expect(
  verdicts.some((verdict) => verdict.startsWith('"new" is 4 and has no baseline.')),
  "an unlisted count passes",
);
expect(
  verdicts.some((verdict) => verdict.startsWith('ratchets.json counts "gone"')),
  "a stale baseline entry passes",
);
for (const verdict of verdicts) {
  expect(form.test(verdict), `message not in <what>. <why>. Fix: <step>. form: ${verdict}`);
}
same(verdictsOf({ a: 2 }, { a: 2 }), [], "matching counts");

same(
  measuredCounts("bytes.json", '{"startup bytes": 120}', {}),
  { counts: { "startup bytes": 120 }, errors: [] },
  "a measured count",
);
const measuredForm =
  /^[^]+\. A measured count comes from the JSON object of whole numbers its task writes[^]*\. Fix: [^]+\.$/u;
for (const [text, counted, message] of [
  [undefined, {}, "a missing counts file"],
  ["[]", {}, "a counts file with no counts"],
  ['{"startup bytes": 1.5}', {}, "a count that is not a whole number"],
  ['{"startup bytes": -1}', {}, "a negative count"],
  ['{"inline suppressions": 0}', { "inline suppressions": 0 }, "a count named like a built-in one"],
]) {
  const { errors } = measuredCounts("bytes.json", text, counted);
  expect(errors.length === 1 && measuredForm.test(errors[0]), `${message} passes or fails out of form: ${errors}`);
}

const repo = mkdtempSync(path.join(tmpdir(), "ratchet-"));
execFileSync("git", ["init", "-q"], { cwd: repo });
writeFileSync(path.join(repo, "knip.config.ts"), 'export default { ignoreFiles: ["eval/**"] };\n');
writeFileSync(path.join(repo, "oxlint.config.ts"), 'export default { rules: { "eslint/no-console": "off" } };\n');
writeFileSync(path.join(repo, "main.ts"), "export const answer = 42;\n");
writeFileSync(path.join(repo, "package.json"), "{}\n");
const cliIn = async (args) =>
  run("node", [cli, ...args], { cwd: repo }).then(
    ({ stdout, stderr }) => ({ code: 0, stderr, stdout }),
    (error) => ({ code: error.code, stderr: error.stderr, stdout: error.stdout }),
  );

const printed = await cliIn(["--print"]);
writeFileSync(path.join(repo, "ratchets.json"), printed.stdout);

for (const invalid of [
  'trustPolicyExclude: "mutant-cafe@0.1.6"\n',
  "trustPolicyExclude: [1]\n",
  "trustPolicyExclude: [\n",
]) {
  writeFileSync(path.join(repo, "pnpm-workspace.yaml"), invalid);
  expect((await cliIn([])).code !== 0, "invalid trust policy configuration passes");
}
writeFileSync(path.join(repo, "pnpm-workspace.yaml"), "trustPolicy: no-downgrade\n");
same(
  JSON.parse(printed.stdout),
  {
    "knip.config.ts exceptions": 1,
    "oxlint.config.ts rules off": 1,
    "oxlint.config.ts override rules per glob": 0,
    "oxlint.config.ts ignore patterns": 0,
    "inline suppressions": 0,
    "patched dependencies": 0,
    "files over 500 lines": 0,
  },
  "--print counts a fixture repo",
);
expect((await cliIn([])).code === 0, "the CLI fails a repo at its baseline");

writeFileSync(path.join(repo, "long.md"), "a line\n".repeat(501));
const long = await cliIn([]);
expect(
  long.code === 1 &&
    long.stderr.includes('"files over 500 lines" grew from 0 to 1') &&
    long.stderr.includes("  long.md (501 lines)"),
  `the CLI passes a new 501-line file without naming it: ${long.stderr}`,
);
rmSync(path.join(repo, "long.md"));

writeFileSync(path.join(repo, "pnpm-workspace.yaml"), 'trustPolicyExclude:\n  - "mutant-cafe@0.1.6"\n');
const trusted = await cliIn([]);
expect(
  trusted.code === 1 && trusted.stderr.includes('"trust policy exceptions" is 1 and has no baseline.'),
  `the CLI passes an uncounted trust policy exception: ${trusted.stderr}`,
);
writeFileSync(path.join(repo, "ratchets.json"), (await cliIn(["--print"])).stdout);
expect((await cliIn([])).code === 0, "the CLI fails a counted trust policy exception");
writeFileSync(path.join(repo, "pnpm-workspace.yaml"), 'trustPolicyExclude: ["mutant-cafe@0.1.6"]\n');
expect((await cliIn([])).code === 0, "flow selectors are counted differently");
writeFileSync(
  path.join(repo, "pnpm-workspace.yaml"),
  'trustPolicyExclude:\n  # approved version\n  - "mutant-cafe@0.1.6"\n\nallowBuilds:\n  lefthook: true\n',
);
expect((await cliIn([])).code === 0, "comments, blank lines or other settings affect the count");
writeFileSync(path.join(repo, "pnpm-workspace.yaml"), 'trustPolicyExclude:\n  - "mutant-cafe@0.1.6"\n  - "other@1"\n');
expect(
  (await cliIn([])).stderr.includes('"trust policy exceptions" grew from 1 to 2.'),
  "a new trust exception passes",
);
writeFileSync(path.join(repo, "pnpm-workspace.yaml"), "trustPolicy: no-downgrade\n");
expect(
  (await cliIn([])).stderr.includes('ratchets.json counts "trust policy exceptions"'),
  "a removed trust exception leaves room",
);
writeFileSync(path.join(repo, "ratchets.json"), printed.stdout);

writeFileSync(path.join(repo, "knip.config.ts"), 'export default { ignoreFiles: ["eval/**", "tmp/**"] };\n');
writeFileSync(path.join(repo, "extra.ts"), `// ${"oxlint"}-disable-next-line\nexport const extra = 1;\n`);
const grown = await cliIn([]);
expect(grown.code === 1, "the CLI passes a grown knip exception and an untracked suppression");
expect(grown.stderr.includes('"knip.config.ts exceptions" grew from 1 to 2.'), `grown knip message: ${grown.stderr}`);
expect(grown.stderr.includes('"inline suppressions" grew from 0 to 1.'), `grown suppression message: ${grown.stderr}`);

writeFileSync(
  path.join(repo, "ratchets.json"),
  JSON.stringify({ ...JSON.parse(printed.stdout), "knip.config.ts exceptions": 2, "inline suppressions": 1 }),
);
expect((await cliIn([])).code === 0, "the CLI fails a raise made in ratchets.json");

const atBaseline = readFileSync(path.join(repo, "ratchets.json"), "utf8");
const tsconfigWith = (severity) =>
  `{\n  // the language service's diagnostics for this package\n  "compilerOptions": {\n    "plugins": [{ "name": "@effect/language-service", "diagnosticSeverity": ${severity}, }],\n  },\n}\n`;
writeFileSync(path.join(repo, "tsconfig.json"), tsconfigWith('{ "apiStabilityLeak": "off" }'));
const turnedOff = await cliIn([]);
expect(
  turnedOff.code === 1 && turnedOff.stderr.includes('"tsconfig.json diagnostics off" is 1 and has no baseline.'),
  `the CLI passes a diagnostic turned off in a tsconfig: ${turnedOff.stderr}`,
);
writeFileSync(path.join(repo, "ratchets.json"), (await cliIn(["--print"])).stdout);
expect((await cliIn([])).code === 0, "the CLI fails a tsconfig override recorded in ratchets.json");
writeFileSync(path.join(repo, "tsconfig.json"), tsconfigWith('{ "apiStabilityLeak": "error" }'));
const turnedOn = await cliIn([]);
expect(
  turnedOn.code === 1 &&
    turnedOn.stderr.includes('ratchets.json counts "tsconfig.json diagnostics off", which this repo no longer has.'),
  `the CLI passes a tsconfig override removed while ratchets.json still counts it: ${turnedOn.stderr}`,
);
writeFileSync(path.join(repo, "ratchets.json"), atBaseline);
expect((await cliIn([])).code === 0, "the CLI fails a tsconfig that turns nothing off");

const mirror = layoutOf([
  "package.json",
  "src/host/command-runner.service.ts",
  "tests/host/command-runner.service.test.ts",
  "tests/host/command-runner.service.portable.test.ts",
  "tests/host/command-runner.service.live.test.ts",
  "tests/host/command-runner.service.types.test.ts",
  "tests/host/command-runner.service.composed.test.ts",
  "src/components/search-palette.view.tsx",
  "tests/components/search-palette.view.test.tsx",
  "tests/host/command-runner.fake.ts",
  "tests/host/command-runner.workload.ts",
  "eval/names/v_bad.test.ts",
  "fixtures/structure/room.test.ts",
  "test/fixtures/structure/room.test.ts",
  "bench/fence-loop.workload.mjs",
  "bench/archil-gate.test.mjs",
]);
same(mirror, { counts: {}, details: {} }, "a valid mirror, with support files, out-of-scope data and a root bench/");

const misplaced = layoutOf([
  "package.json",
  "packages/effect/package.json",
  "packages/effect/src/host/command-runner.service.ts",
  "packages/effect/src/host/command-runner.test.ts",
  "packages/effect/test/history.test.ts",
  "packages/effect/tests/host/command-history.test.ts",
  "packages/effect/src/host/room.fake.ts",
  "packages/effect/tests/host/world.fake.ts",
  "packages/effect/tests/host/command-runner.service.flaky.test.ts",
  "packages/effect/bench/g1-host.workload.mjs",
  "packages/effect/src/bench/probe.workload.ts",
]);
same(
  misplaced.counts,
  { "tests outside the mirror in packages/effect": 7 },
  "misplaced tests and support files, where only a package-root bench/ is out of scope",
);
const lines = misplaced.details["tests outside the mirror in packages/effect"].join("\n");
expect(
  lines.includes("Fix: move it to packages/effect/tests/host/command-runner.<role>.test.ts"),
  `a test inside src/ names its mirrored path with the role of the file it tests: ${lines}`,
);
expect(
  lines.includes('import that file as #src/<path>, with no extension, through the package.json\'s "#src/*" import'),
  `a misplaced test names the #src/* alias it imports through: ${lines}`,
);
expect(
  lines.includes("Fix: move it to packages/effect/tests/<path of the src/ file it tests>.<role>.test.ts"),
  `a test in test/ asks for tests/: ${lines}`,
);
expect(
  lines.includes("has no source file packages/effect/src/host/command-history.<ext> to test"),
  `a test with no mirrored source names the missing path: ${lines}`,
);
expect(lines.includes("room.fake.ts is a fake outside tests/"), `a fake inside src/ fails: ${lines}`);
expect(
  lines.includes("src/bench/probe.workload.ts is a workload outside tests/"),
  `a bench/ under src/ is in scope: ${lines}`,
);
expect(
  lines.includes("has no source file packages/effect/src/host/command-runner.service.flaky.<ext> to test"),
  `a test aspect outside the fixed list names no source: ${lines}`,
);
expect(
  lines.includes("names no source file packages/effect/src/host/world.<role>.<ext>"),
  `a fake named for no source fails: ${lines}`,
);
for (const line of lines.split("\n")) {
  expect(
    /^\S+ [^]+\. Tests live in tests\/ and mirror src\/ file for file[^]*\. Fix: [^]+\.$/u.test(line),
    `message form: ${line}`,
  );
}

const folder = (count) => Array.from({ length: count }, (_, index) => `src/host/file-${index}.pure.ts`);
same(layoutOf(["package.json", ...folder(10)]).counts, {}, "a folder at the cap of 10");
same(
  layoutOf(["package.json", ...folder(11), "src/host/nested/one.pure.ts", "src/host/types.d.ts"]).counts,
  { "code files in src/host (cap 10)": 11 },
  "a folder over the cap counts only its own code files",
);

writeFileSync(path.join(repo, "src.test.ts"), "export const loose = 1;\n");
const loose = await cliIn([]);
expect(loose.code === 1, "the CLI passes a new test outside tests/");
expect(
  loose.stderr.includes('"tests outside the mirror in ." is 1 and has no baseline.') &&
    loose.stderr.includes("  src.test.ts is a test outside tests/."),
  `a new test outside the mirror is named under its count: ${loose.stderr}`,
);

writeFileSync(path.join(repo, "bytes.json"), '{"startup bytes": 120}\n');
writeFileSync(
  path.join(repo, "ratchets.json"),
  JSON.stringify({ ...JSON.parse((await cliIn(["--print"])).stdout), "startup bytes": 120 }),
);
expect((await cliIn(["--counts", "bytes.json"])).code === 0, "the CLI fails a measured count at its baseline");
writeFileSync(path.join(repo, "bytes.json"), '{"startup bytes": 121}\n');
const heavier = await cliIn(["--counts", "bytes.json"]);
expect(
  heavier.code === 1 && heavier.stderr.includes('"startup bytes" grew from 120 to 121.'),
  `the CLI passes a grown measured count: ${heavier.stderr}`,
);
const unmeasured = await cliIn(["--counts", "absent.json"]);
expect(
  unmeasured.code === 1 && unmeasured.stderr.includes("--counts absent.json names no file."),
  `the CLI passes a counts file that was never written: ${unmeasured.stderr}`,
);
expect(
  (await cliIn([])).stderr.includes('ratchets.json counts "startup bytes", which this repo no longer has.'),
  "the CLI passes a measured baseline with no --counts",
);

mkdirSync(path.join(repo, "packages", "core"), { recursive: true });
writeFileSync(
  path.join(repo, "packages", "core", "mutants.equivalent.json"),
  JSON.stringify({ a1: { at: "src/a.ts:1:1", mutant: "replace a with 0", reason: "a is always 0 here" } }),
);
const listed = await cliIn([]);
expect(listed.code === 1, "the CLI passes an equivalent mutant with no baseline");
expect(
  listed.stderr.includes('"equivalent mutants" is 1 and has no baseline.'),
  `equivalent mutants message: ${listed.stderr}`,
);
writeFileSync(
  path.join(repo, "packages", "core", "mutants.baseline.json"),
  JSON.stringify({
    b1: { at: "src/b.ts:1:1", mutant: "replace b with 0" },
    b2: { at: "src/b.ts:2:1", mutant: "replace b with 1" },
  }),
);
const baselined = await cliIn([]);
expect(
  baselined.stderr.includes('"baseline surviving mutants" is 2 and has no baseline.'),
  `baseline survivors message: ${baselined.stderr}`,
);

const scripts = JSON.parse(readFileSync(path.join(workspaceRoot, "package.json"), "utf8")).scripts;
expect(/\bratchet\b/u.test(scripts.check), "pnpm check does not run the ratchet");
expect(
  (await run("node", [cli], { cwd: workspaceRoot }).then(
    () => 0,
    (error) => error.code,
  )) === 0,
  "this repo is off its ratchets.json",
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  "ratchet: oxlint, knip, tsconfig, patch, suppression and equivalent-mutant counts, the four verdicts, the tests mirror and folder cap, a fixture repo through the CLI, measured counts from --counts, and this repo's baseline",
);
