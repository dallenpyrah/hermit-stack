import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { linesOf, overCap, verdictsOf } from "../../src/fence/file-fence.pure.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const cli = path.join(root, "src", "fence", "file-fence.cli.mjs");
const run = promisify(execFile);
const failures = [];
const expect = (holds, message) => {
  if (!holds) {
    failures.push(message);
  }
};
const form = /^.+\. .+\. Fix: .+\.$/u;

const lines = (count, ending = "\n") =>
  `${Array.from({ length: count }, (_, index) => `line ${index}`).join("\n")}${ending}`;

expect(linesOf("") === 0, "an empty file has 0 lines");
expect(
  linesOf(lines(500)) === 500 && linesOf(lines(500, "")) === 500,
  "a last line counts with or without its newline",
);

const atCap = { path: "src/a.service.ts", text: lines(500) };
const overByOne = { path: "docs/long.md", text: lines(501) };
const unended = { path: "native/akcrypt.c", text: lines(501, "") };
expect(
  JSON.stringify(overCap([atCap, overByOne, unended]).map(({ path: file }) => file)) ===
    JSON.stringify(["docs/long.md", "native/akcrypt.c"]),
  `500 lines pass and 501 fail, Markdown and C included: ${JSON.stringify(overCap([atCap, overByOne, unended]))}`,
);

const generated = [
  "pnpm-lock.yaml",
  "patches/mutant-cafe@0.1.6.patch",
  "packages/cloud-api/openapi.json",
  "packages/effect/contracts.json",
  "packages/effect/mutants.baseline.json",
  "packages/cloud-api/package.json",
  "src/schema.gen.ts",
  "vendor/alchemy/README.md",
  "src/oxlint/anti-slop/shared/dictionary-types.ts",
];
expect(
  overCap(generated.map((file) => ({ path: file, text: lines(900) }))).length === 0,
  `generated, vendored and manifest files are uncapped: ${JSON.stringify(overCap(generated.map((file) => ({ path: file, text: lines(900) }))))}`,
);
expect(
  overCap([{ path: "packages/cloud-api/package.json.md", text: lines(900) }]).length === 1,
  "a file only named like a manifest is still capped",
);
expect(overCap([{ path: "assets/logo.png", text: `\0${lines(900)}` }]).length === 0, "a binary file is not capped");

const ts = (word) => `// @ts-${word}`;
const suppressions = [
  `// ${"oxlint"}-disable-next-line taste/no-type-predicates -- a reason`,
  `/* ${"eslint"}-disable */`,
  ts("expect-error"),
  ts("ignore"),
  ts("nocheck"),
];
for (const suppression of suppressions) {
  const verdicts = verdictsOf([
    { path: "src/live-build.layer.ts", text: `const a = 1;\n${suppression}\nconst b = 2;\n` },
  ]);
  expect(
    verdicts.length === 1 &&
      verdicts[0].startsWith("src/live-build.layer.ts:2 turns a rule off inline") &&
      form.test(verdicts[0]),
    `${suppression} is refused at its line: ${JSON.stringify(verdicts)}`,
  );
}
expect(
  verdictsOf([{ path: "docs/rules.md", text: `Never write \`// ${"oxlint"}-disable\` in code.\n` }]).length === 0,
  "a suppression named in prose is not refused",
);
expect(verdictsOf([atCap]).length === 0, "a short source file with no suppression passes");

const repo = mkdtempSync(path.join(tmpdir(), "file-fence-"));
mkdirSync(path.join(repo, "src"));
writeFileSync(path.join(repo, "src", "short.service.ts"), lines(10));
writeFileSync(path.join(repo, "src", "long.service.ts"), lines(600));
const cliOn = (files) =>
  run(process.execPath, [cli, ...files], { cwd: repo }).then(
    ({ stdout }) => ({ code: 0, stderr: "", stdout }),
    (error) => ({ code: error.code, stderr: error.stderr, stdout: error.stdout }),
  );
const passing = await cliOn(["src/short.service.ts", "src/deleted.service.ts"]);
expect(passing.code === 0, `the CLI refuses a short file and a staged deletion: ${passing.stderr}`);
const refused = await cliOn(["src/short.service.ts", "src/long.service.ts"]);
expect(
  refused.code === 1 && refused.stderr.includes("src/long.service.ts has 600 lines"),
  `the CLI passes a 600-line staged file: ${refused.stderr}`,
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("file-fence: ok");
