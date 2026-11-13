#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const why =
  "A task's inputs decide when turbo replays its cached result, so a file left out of them can change while the cached pass stays";
const checkedTask = (task) => ["typecheck", "lint", "test"].includes(task) || task.startsWith("test:");

const tracked = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
  .split("\0")
  .filter((file) => file !== "" && existsSync(path.join(root, file)));
const definitions = ["turbo.json", ...tracked.filter((file) => file.endsWith("/turbo.json"))].flatMap((file) =>
  Object.entries(JSON.parse(readFileSync(path.join(root, file), "utf8")).tasks ?? {}).map(([key, definition]) => ({
    definition,
    name: key.slice(key.indexOf("#") + 1),
  })),
);
const persistent = new Set(
  definitions.filter(({ definition }) => definition.persistent === true).map(({ name }) => name),
);
const names = [...new Set(definitions.map(({ name }) => name).filter((name) => !persistent.has(name)))];
const plan = JSON.parse(
  execFileSync("turbo", ["run", ...names, "--dry=json"], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }),
);

const gaps = plan.tasks
  .filter((task) => task.command !== "<NONEXISTENT>" && checkedTask(task.task))
  .map((task) => {
    const prefix = (task.directory ?? "") === "" ? "" : `${task.directory}/`;
    const hashed = new Set(Object.keys(task.inputs));
    const missing = tracked
      .filter((file) => file.startsWith(`${prefix}src/`) || file.startsWith(`${prefix}tests/`))
      .map((file) => file.slice(prefix.length))
      .filter((file) => !hashed.has(file));
    return { missing, prefix, task };
  })
  .filter(({ missing }) => missing.length > 0);

const tasksById = new Map(plan.tasks.map((task) => [task.taskId, task]));
const hashedBy = (task) => {
  const seen = new Map();
  const queue = [task];
  while (queue.length > 0) {
    const next = queue.pop();
    if (next !== undefined && !seen.has(next.taskId)) {
      seen.set(next.taskId, next);
      queue.push(...next.dependencies.map((id) => tasksById.get(id)));
    }
  }
  return new Set(
    [...seen.values()].flatMap((each) =>
      Object.keys(each.inputs).map((file) => path.resolve(root, each.directory ?? "", file)),
    ),
  );
};
const outsideLinks = (directory) => {
  const manifest = JSON.parse(readFileSync(path.join(root, directory, "package.json"), "utf8"));
  return Object.entries({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies })
    .filter(([, spec]) => /^(?:file|link):/u.test(spec))
    .map(([name, spec]) => ({ at: path.resolve(root, directory, spec.slice(spec.indexOf(":") + 1)), name }))
    .filter(({ at }) => path.relative(root, at).startsWith("..") && existsSync(at));
};
const sourcesOf = (at) =>
  execFileSync("git", ["-C", at, "ls-files", "-z", "src", "package.json"], { encoding: "utf8" })
    .split("\0")
    .filter((file) => file !== "" && !file.includes(".test."))
    .map((file) => path.join(at, file));

const linkGaps = plan.tasks
  .filter((task) => task.command !== "<NONEXISTENT>" && checkedTask(task.task) && (task.directory ?? "") !== "")
  .flatMap((task) => {
    const hashed = hashedBy(task);
    return outsideLinks(task.directory).map(({ at, name }) => ({
      at,
      missing: sourcesOf(at).filter((file) => !hashed.has(file)),
      name,
      task,
    }));
  })
  .filter(({ missing }) => missing.length > 0);

const deadGlobs = plan.tasks.flatMap((task) => {
  const directory = path.resolve(root, task.directory ?? "");
  const hashed = Object.keys(task.inputs).map((file) => path.resolve(directory, file));
  return (task.resolvedTaskDefinition.inputs ?? [])
    .filter((glob) => !glob.startsWith("!"))
    .map((glob) => ({ glob, prefix: path.resolve(directory, glob.split(/[*?{[]/u)[0]) }))
    .filter(
      ({ prefix }) => path.relative(root, prefix).startsWith("..") && !hashed.some((file) => file.startsWith(prefix)),
    )
    .map(({ glob }) => ({ glob, task }));
});

const outsideOf = (task) => {
  const directory = path.resolve(root, task.directory ?? "");
  return (task.resolvedTaskDefinition.inputs ?? []).filter((glob) =>
    path.relative(root, path.resolve(directory, glob.replace(/^!/u, "").split(/[*?{[]/u)[0])).startsWith(".."),
  );
};
const builders = new Set(
  plan.tasks
    .filter((task) => task.command !== "<NONEXISTENT>" && (task.resolvedTaskDefinition.outputs ?? []).length > 0)
    .map((task) => task.directory ?? ""),
);
const walks = plan.tasks
  .filter((task) => (task.directory ?? "") !== "")
  .filter((task) => task.command !== "<NONEXISTENT>" || builders.has(task.directory))
  .map((task) => ({ outside: outsideOf(task), task }))
  .filter(({ outside }) => outside.length > 0);

for (const { outside, task } of walks) {
  console.error(
    `${task.taskId} lists ${outside.join(", ")} outside the repo in its inputs. turbo hashes a task with an input outside the repo by walking its package's whole folder, dist and node_modules included, so a build that deletes files in ${task.directory} during the walk fails the task's hash with "Package traversal error", and every run pays for the walk. Fix: move these inputs to a task with no script in a package that nothing builds into, such as a task in tools/rules, and add that task to ${task.task}'s dependsOn.`,
  );
}

for (const { glob, task } of deadGlobs) {
  console.error(
    `${task.taskId} lists ${glob} outside the repo in its inputs, but hashes no file there. turbo drops every input outside the repo from a root (//#) task, matches no file through a symlinked sibling (turbo 2.11.11), and hashes nothing for a glob that matches nothing. ${why}. Fix: move the glob to the inputs of a package task, such as sibling-inputs in a tooling package, and add that task to ${task.taskId}'s dependsOn; point it at the real folder rather than a symlink to it; or correct it.`,
  );
}

for (const { at, missing, name, task } of linkGaps) {
  const outside = path.relative(root, at);
  console.error(
    [
      `${task.taskId} does not hash ${missing.length} ${missing.length === 1 ? "file" : "files"} of ${name}, which ${task.directory} links from ${outside} outside the repo. ${why}. Fix: add "$TURBO_ROOT$/${outside}/src/**" and "$TURBO_ROOT$/${outside}/package.json" to the inputs of the task or of a task it depends on, such as transit in ${task.directory}/turbo.json.`,
      ...missing.slice(0, 5).map((file) => `  ${path.relative(root, file)}`),
      ...(missing.length > 5 ? [`  and ${missing.length - 5} more`] : []),
    ].join("\n"),
  );
}

for (const { missing, prefix, task } of gaps) {
  console.error(
    [
      `${task.taskId} does not hash ${missing.length} ${missing.length === 1 ? "file" : "files"} of ${prefix === "" ? "the repo" : prefix.slice(0, -1)} under src/ or tests/. ${why}. Fix: start its inputs in ${prefix}turbo.json with "$TURBO_DEFAULT$" or "$TURBO_EXTENDS$", or list src/** and tests/**.`,
      ...missing.slice(0, 5).map((file) => `  ${prefix}${file}`),
      ...(missing.length > 5 ? [`  and ${missing.length - 5} more`] : []),
    ].join("\n"),
  );
}
if (gaps.length > 0 || linkGaps.length > 0 || deadGlobs.length > 0 || walks.length > 0) {
  process.exit(1);
}
console.log(
  `task-inputs: ${plan.tasks.filter((task) => task.command !== "<NONEXISTENT>" && checkedTask(task.task)).length} typecheck, lint and test tasks hash every file under their package's src/ and tests/, and the src/ of each package they link from outside the repo, and every input outside the repo hashes a file, on a task with no script in a package nothing builds into`,
);
