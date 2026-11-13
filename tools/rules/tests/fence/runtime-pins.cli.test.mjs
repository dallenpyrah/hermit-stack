import { execFile } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { pinsOf, verdictsOf } from "../../src/fence/runtime-pins.pure.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const cli = path.join(root, "src", "fence", "runtime-pins.cli.mjs");
const run = promisify(execFile);
const failures = [];
const expect = (holds, message) => {
  if (!holds) {
    failures.push(message);
  }
};
const form = /^.+\. .+\. Fix: .+\.$/u;

const toml = '[tools]\nnode = "24.22.2"\npnpm = "12.16.1"\nbun = "1.4.4"\n\n[env]\nbun = "9.9.9"\n';
expect(
  JSON.stringify(pinsOf(toml)) === JSON.stringify({ node: "24.22.2", bun: "1.4.4" }),
  `pinsOf reads node and bun from [tools] only: ${JSON.stringify(pinsOf(toml))}`,
);
expect(JSON.stringify(pinsOf('[tools]\njava = "21"\n')) === "{}", "pinsOf keeps runtimes other than node and bun");

const pins = { bun: "1.4.4", node: "24" };
const cases = [
  ["the pinned versions", { bun: { path: "/b", version: "1.4.4" }, node: { path: "/n", version: "24.22.2" } }, []],
  [
    "an older bun",
    { bun: { path: "/opt/homebrew/bin/bun", version: "1.4.3" }, node: { path: "/n", version: "24.22.2" } },
    ["bun 1.4.3 runs from /opt/homebrew/bin/bun, but mise.toml pins 1.4.4."],
  ],
  [
    "a node outside the pinned major",
    { bun: { path: "/b", version: "1.4.4" }, node: { path: "/n", version: "26.7.0" } },
    ["node 26.7.0 runs from /n, but mise.toml pins 24."],
  ],
  [
    "a version that only shares a prefix",
    { bun: { path: "/b", version: "1.4.40" }, node: { path: "/n", version: "24.22.2" } },
    ["bun 1.4.40 runs from /b, but mise.toml pins 1.4.4."],
  ],
  ["a missing bun", { node: { path: "/n", version: "24.1.0" } }, ["bun is not on PATH, but mise.toml pins 1.4.4."]],
];
for (const [label, seen, expected] of cases) {
  const verdicts = verdictsOf(pins, seen);
  expect(
    verdicts.length === expected.length && expected.every((start, index) => verdicts[index].startsWith(start)),
    `${label}: ${JSON.stringify(verdicts)}`,
  );
  for (const verdict of verdicts) {
    expect(form.test(verdict), `${label}: not in <what>. <why>. Fix: <step>. form: ${verdict}`);
  }
}

const fakeRuntimes = (versions) => {
  const repo = mkdtempSync(path.join(tmpdir(), "runtime-pins-"));
  const bin = path.join(repo, "bin");
  mkdirSync(bin);
  writeFileSync(path.join(repo, "mise.toml"), `[tools]\nnode = "${process.versions.node}"\nbun = "1.4.4"\n`);
  for (const [name, version] of Object.entries(versions)) {
    writeFileSync(path.join(bin, name), `#!/bin/sh\necho ${version}\n`);
    chmodSync(path.join(bin, name), 0o755);
  }
  return { bin, repo };
};
const cliWith = async (versions) => {
  const { bin, repo } = fakeRuntimes(versions);
  return run(process.execPath, [cli], { cwd: repo, env: { PATH: `${bin}:/usr/bin:/bin` } }).then(
    ({ stdout }) => ({ code: 0, stderr: "", stdout }),
    (error) => ({ code: error.code, stderr: error.stderr, stdout: error.stdout }),
  );
};
const pinned = await cliWith({ bun: "1.4.4", node: `v${process.versions.node}` });
expect(pinned.code === 0 && pinned.stdout.includes("bun 1.4.4"), `the CLI fails pinned runtimes: ${pinned.stderr}`);
const olderBun = await cliWith({ bun: "1.4.3", node: `v${process.versions.node}` });
expect(
  olderBun.code === 1 && olderBun.stderr.includes("bun 1.4.3 runs from") && olderBun.stderr.includes("pins 1.4.4"),
  `the CLI passes a fake bun 1.4.3 on PATH: ${olderBun.stderr}`,
);
const otherNode = await cliWith({ bun: "1.4.4", node: "v0.0.1" });
expect(
  otherNode.code === 1 && otherNode.stderr.includes("node 0.0.1 runs from"),
  `the CLI passes a fake node 0.0.1 on PATH: ${otherNode.stderr}`,
);
const noBun = await cliWith({ node: `v${process.versions.node}` });
expect(
  noBun.code === 1 && noBun.stderr.includes("bun is not on PATH"),
  `the CLI passes without bun on PATH: ${noBun.stderr}`,
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("runtime-pins: ok");
