import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const root = path.resolve(import.meta.dirname, "../..");
const cli = path.join(root, "src", "turbo", "task-inputs.cli.mjs");
const run = promisify(execFile);
const failures = [];
const expect = (holds, message) => {
  if (!holds) {
    failures.push(message);
  }
};

const repo = mkdtempSync(path.join(tmpdir(), "task-inputs-"));
const write = (file, text) => {
  mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  writeFileSync(path.join(repo, file), text);
};
const json = (value) => JSON.stringify(value, null, 2);
const packageInputs = (inputs) =>
  write("packages/clock/turbo.json", json({ extends: ["//"], tasks: { test: { inputs } } }));

write("package.json", json({ name: "fixture", packageManager: "pnpm@10.0.0", private: true }));
write("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
write("turbo.json", json({ tasks: { build: { inputs: ["src/**"] }, test: { inputs: ["src/**", "tests/**"] } } }));
write("packages/clock/package.json", json({ name: "clock", private: true, scripts: { build: "true", test: "true" } }));
write("packages/clock/src/clock.pure.ts", "export const now = 0;\n");
write("packages/clock/tests/clock.pure.test.ts", 'import { now } from "#src/clock.pure.js";\n');
packageInputs(["*.ts", "package.json"]);
execFileSync("git", ["init", "-q"], { cwd: repo });

const env = {
  ...process.env,
  PATH: `${path.join(root, "node_modules", ".bin")}${path.delimiter}${process.env.PATH}`,
  TURBO_TELEMETRY_DISABLED: "1",
};
const outcome = (pending) =>
  pending.then(
    ({ stderr, stdout }) => ({ code: 0, output: stdout + stderr }),
    (error) => ({ code: error.code, output: String(error.stdout) + String(error.stderr) }),
  );

const topLevel = await outcome(run("node", [cli], { cwd: repo, env }));
expect(topLevel.code === 1, `inputs of "*.ts" pass:\n${topLevel.output}`);
expect(
  topLevel.output.includes("clock#test does not hash 2 files of packages/clock under src/ or tests/") &&
    topLevel.output.includes("packages/clock/src/clock.pure.ts") &&
    topLevel.output.includes("packages/clock/tests/clock.pure.test.ts"),
  `the failure does not name the task and both files:\n${topLevel.output}`,
);
expect(
  !topLevel.output.includes("clock#build"),
  `a build task, which may leave tests out, is checked:\n${topLevel.output}`,
);

packageInputs(["$TURBO_DEFAULT$"]);
const everyFile = await outcome(run("node", [cli], { cwd: repo, env }));
expect(everyFile.code === 0, `inputs of "$TURBO_DEFAULT$" fail:\n${everyFile.output}`);

packageInputs(["src/**", "package.json"]);
const sourceOnly = await outcome(run("node", [cli], { cwd: repo, env }));
expect(
  sourceOnly.code === 1 && sourceOnly.output.includes("clock#test does not hash 1 file of packages/clock"),
  `inputs that leave out tests/ pass:\n${sourceOnly.output}`,
);

const outside = `${repo}-lib`;
mkdirSync(path.join(outside, "src"), { recursive: true });
writeFileSync(path.join(outside, "package.json"), json({ name: "lib", private: true }));
writeFileSync(path.join(outside, "src", "lib.pure.ts"), "export const lib = 0;\n");
execFileSync("git", ["init", "-q"], { cwd: outside });
execFileSync("git", ["add", "."], { cwd: outside });
write(
  "packages/clock/package.json",
  json({
    devDependencies: { lib: `file:../../../${path.basename(outside)}` },
    name: "clock",
    private: true,
    scripts: { build: "true", test: "true", transit: "true" },
  }),
);
const linkedInputs = [
  `$TURBO_ROOT$/../${path.basename(outside)}/src/**`,
  `$TURBO_ROOT$/../${path.basename(outside)}/package.json`,
];
const clockTasks = (tasks) => write("packages/clock/turbo.json", json({ extends: ["//"], tasks }));

clockTasks({ test: { inputs: ["src/**", "tests/**", "package.json"] } });
const unhashedLink = await outcome(run("node", [cli], { cwd: repo, env }));
expect(
  unhashedLink.code === 1 &&
    unhashedLink.output.includes(
      `clock#test does not hash 2 files of lib, which packages/clock links from ../${path.basename(outside)} outside the repo`,
    ) &&
    unhashedLink.output.includes(`../${path.basename(outside)}/src/lib.pure.ts`),
  `a package linked from outside the repo whose src/ no task hashes passes:\n${unhashedLink.output}`,
);

write("packages/tooling/package.json", json({ name: "tooling", private: true }));
const toolingTasks = (tasks) => write("packages/tooling/turbo.json", json({ extends: ["//"], tasks }));
const linkedTransit = {
  test: { dependsOn: ["transit"], inputs: ["src/**", "tests/**", "package.json"] },
  transit: { dependsOn: ["tooling#lib-inputs"], inputs: ["src/**"] },
};

clockTasks(linkedTransit);
toolingTasks({ "lib-inputs": { inputs: linkedInputs } });
const hashedByDependency = await outcome(run("node", [cli], { cwd: repo, env }));
expect(
  hashedByDependency.code === 0,
  `a linked package hashed by a tooling task that transit, which test depends on, depends on fails:\n${hashedByDependency.output}`,
);

clockTasks({
  test: { dependsOn: ["transit"], inputs: ["src/**", "tests/**", "package.json"] },
  transit: { inputs: ["src/**", ...linkedInputs] },
});
const walkedByScript = await outcome(run("node", [cli], { cwd: repo, env }));
expect(
  walkedByScript.code === 1 &&
    walkedByScript.output.includes(
      `clock#transit lists ../../../${path.basename(outside)}/package.json, ../../../${path.basename(outside)}/src/** outside the repo in its inputs. turbo hashes a task with an input outside the repo by walking its package's whole folder`,
    ),
  `a task with a script and an input outside the repo, which turbo hashes by walking its package, passes:\n${walkedByScript.output}`,
);

const lib = path.basename(outside);
const rootTasks = (tasks) =>
  write(
    "turbo.json",
    json({
      tasks: {
        build: { inputs: ["src/**"], outputs: ["dist/**"] },
        test: { inputs: ["src/**", "tests/**"] },
        ...tasks,
      },
    }),
  );
rootTasks({});
clockTasks({ ...linkedTransit, "sibling-inputs": { inputs: [`$TURBO_ROOT$/../${lib}/src/**`] } });
const walkedBuilder = await outcome(run("node", [cli], { cwd: repo, env }));
expect(
  walkedBuilder.code === 1 &&
    walkedBuilder.output.includes(`clock#sibling-inputs lists ../../../${lib}/src/** outside the repo`),
  `a task with no script and an input outside the repo, in a package build writes dist into, passes:\n${walkedBuilder.output}`,
);

write(
  "package.json",
  json({ name: "fixture", packageManager: "pnpm@10.0.0", private: true, scripts: { "lint:sibling": "true" } }),
);
clockTasks(linkedTransit);

rootTasks({ "//#lint:sibling": { inputs: ["package.json", `$TURBO_ROOT$/../${lib}/src/**`] } });
const droppedByRoot = await outcome(run("node", [cli], { cwd: repo, env }));
expect(
  droppedByRoot.code === 1 &&
    droppedByRoot.output.includes(
      `//#lint:sibling lists ./../${lib}/src/** outside the repo in its inputs, but hashes no file there`,
    ),
  `a root task whose outside glob turbo drops passes:\n${droppedByRoot.output}`,
);

rootTasks({ "//#lint:sibling": { dependsOn: ["tooling#sibling-inputs"], inputs: ["package.json"] } });
toolingTasks({
  "lib-inputs": { inputs: linkedInputs },
  "sibling-inputs": { inputs: [`$TURBO_ROOT$/../${lib}/src/**`] },
});
const hashedBySibling = await outcome(run("node", [cli], { cwd: repo, env }));
expect(
  hashedBySibling.code === 0,
  `a root task depending on a tooling task that hashes the outside files fails:\n${hashedBySibling.output}`,
);

toolingTasks({
  "lib-inputs": { inputs: linkedInputs },
  "sibling-inputs": { inputs: [`$TURBO_ROOT$/../${lib}/missing/**`] },
});
const matchesNothing = await outcome(run("node", [cli], { cwd: repo, env }));
expect(
  matchesNothing.code === 1 &&
    matchesNothing.output.includes(`tooling#sibling-inputs lists ../../../${lib}/missing/** outside the repo`),
  `an outside glob that matches nothing passes:\n${matchesNothing.output}`,
);

const linked = `${repo}-linked`;
symlinkSync(outside, linked);
const siblingThroughLink = (glob) =>
  toolingTasks({
    "lib-inputs": { inputs: linkedInputs },
    "sibling-inputs": { inputs: [`$TURBO_ROOT$/../${path.basename(linked)}/${glob}`] },
  });

siblingThroughLink("src/lib.*");
const starThroughLink = await outcome(run("node", [cli], { cwd: repo, env }));
expect(
  starThroughLink.code === 1 &&
    starThroughLink.output.includes(
      `tooling#sibling-inputs lists ../../../${path.basename(linked)}/src/lib.* outside the repo`,
    ),
  `a name.* glob through a symlinked sibling, which turbo matches to nothing, passes:\n${starThroughLink.output}`,
);

siblingThroughLink("src/**");
const globstarThroughLink = await outcome(run("node", [cli], { cwd: repo, env }));
expect(
  globstarThroughLink.code === 1 &&
    globstarThroughLink.output.includes(
      `tooling#sibling-inputs lists ../../../${path.basename(linked)}/src/** outside the repo`,
    ),
  `a ** glob through a symlinked sibling, which turbo 2.11.11 matches to nothing, passes:\n${globstarThroughLink.output}`,
);

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}
console.log(
  'task-inputs: "*.ts", src/** without tests/**, an unhashed outside link, an outside input on a task with a script or in a package build writes into, an outside glob that hashes nothing and any glob through a symlinked sibling fail, $TURBO_DEFAULT$, a link hashed by a tooling task and a root task depending on sibling-inputs pass, and build is not checked',
);
