const pinned = ["mise", "exec", "--"];

const unpinned = (words) => (pinned.every((word, index) => words[index] === word) ? words.slice(pinned.length) : words);

const commandsOf = (script) =>
  script
    .split("&&")
    .map((command) => unpinned(command.trim().split(/\s+/u)))
    .filter((words) => words.length > 0 && words[0] !== "");

const expanded = (scripts, name) => {
  const commands = commandsOf(scripts[name] ?? "");
  const [only] = commands;
  const reference =
    commands.length === 1 && only[0] === "pnpm" && (only[1] === "check" || (only[1] === "run" && only[2] === "check"));
  if (!reference) {
    return commands;
  }
  const flags = only.slice(only[1] === "run" ? 3 : 2);
  const check = commandsOf(scripts.check ?? "");
  return check.map((words, index) => (index === check.length - 1 ? [...words, ...flags] : words));
};

const isTurboRun = (words) => words[0] === "turbo" && words[1] === "run";
const tasksOf = (commands) =>
  commands.filter(isTurboRun).flatMap((words) => words.slice(2).filter((word) => !word.startsWith("-")));
const flagsOf = (commands) =>
  commands.filter(isTurboRun).flatMap((words) => words.slice(2).filter((word) => word.startsWith("-")));
const otherCommandsOf = (commands) => commands.filter((words) => !isTurboRun(words)).map((words) => words.join(" "));

const why =
  "Agents and the pre-push loop run check:affected, so a task only check runs lets its failures through until a full check or landing";
const fix = 'define check:affected as "pnpm check --affected"';

const verdictsOf = (scripts) => {
  if (scripts.check === undefined || scripts["check:affected"] === undefined) {
    return [];
  }
  const check = commandsOf(scripts.check);
  const affected = expanded(scripts, "check:affected");
  const affectedTasks = tasksOf(affected);
  const checkTasks = tasksOf(check);
  const affectedOthers = otherCommandsOf(affected);
  return [
    ...checkTasks
      .filter((task) => !affectedTasks.includes(task))
      .map((task) => `check:affected skips ${task}, which check runs. ${why}. Fix: ${fix}.`),
    ...affectedTasks
      .filter((task) => !checkTasks.includes(task))
      .map(
        (task) =>
          `check:affected runs ${task}, which check does not. The two gates must run the same tasks. Fix: ${fix}.`,
      ),
    ...otherCommandsOf(check)
      .filter((command) => !affectedOthers.includes(command))
      .map((command) => `check:affected skips \`${command}\`, which check runs. ${why}. Fix: ${fix}.`),
    ...(flagsOf(affected).includes("--affected")
      ? []
      : [
          `check:affected does not pass --affected to turbo run. Without it the affected gate runs everything, or runs a different set. Fix: ${fix}.`,
        ]),
  ];
};

export { verdictsOf };
