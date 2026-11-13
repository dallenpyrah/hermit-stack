import { execFile } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { commandVerdict, fileVerdict, messageOf } from "../../src/fence/git-fence.pure.mjs";

const root = path.resolve(import.meta.dirname, "../..");
// The agent hooks are configured once for the whole monorepo, at its root.
const workspaceRoot = path.resolve(root, "../..");
const cli = path.join(root, "src", "fence", "git-fence.cli.mjs");
const run = promisify(execFile);
const failures = [];
const expect = (holds, message) => {
  if (!holds) {
    failures.push(message);
  }
};

const cases = {
  blocked: [
    "git commit --no-verify -m wip",
    "git commit -n -m wip",
    "git commit -anm wip",
    "git commit -am wip --no-verif",
    "git push --no-verify",
    "git push origin main --no-verify",
    "LEFTHOOK=0 git commit -m x",
    "env LEFTHOOK=false git commit -m x",
    "export LEFTHOOK=0",
    "git -c core.hooksPath=/dev/null commit -m x",
    "git -c core.hookspath=x push",
    "git config core.hooksPath /tmp/none",
    "git config --local core.hooksPath .nohooks",
    "git config --unset core.hooksPath",
    "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/x git commit -m y",
    "cd akter && git commit --no-verify -m x",
    "pnpm fmt; git commit -n -m x",
    "bash -c 'git commit --no-verify -m x'",
    'sh -lc "git push --no-verify"',
    "eval git commit --no-verify -m x",
    'echo "$(git commit -n -m x)"',
    "lefthook uninstall",
    "rm .git/hooks/pre-commit",
    "rm -rf .git/hooks",
    "echo '' > .git/hooks/pre-commit",
    "git merge --no-verify feature",
    "LEFTHOOK_BIN=/usr/bin/true git commit -m x",
    "LEFTHOOK_EXCLUDE=lint git commit -m x",
    "sudo git commit --no-verify",
    "/usr/bin/git commit -n",
    "git --git-dir=.git -C . commit --no-verify",
    // core.hooksPath given before any subcommand, in each spelling git takes.
    "git -c core.hooksPath=/dev/null rebase --continue",
    "git -c core.hooksPath=/dev/null status",
    "git -C . -c core.hooksPath=/dev/null rebase --continue",
    "git --no-pager -c core.hooksPath=/dev/null merge feature",
    "git -c user.name=x -c core.hooksPath=/dev/null cherry-pick abc",
    "git -ccore.hooksPath=/dev/null commit -m x",
    "git -c 'core.hooksPath=/dev/null' am patch.mbox",
    "git -c CORE.HOOKSPATH=/x commit -m x",
    "git -c core.hooksPath rebase --continue",
    "git --config-env core.hooksPath=HOOKS commit -m x",
    "git --config-env=core.hooksPath=HOOKS rebase --continue",
    "GIT_CONFIG_PARAMETERS=\"'core.hooksPath'='/dev/null'\" git commit -m x",
    "export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/x",
    "env GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/x git push",
    // Another config file, which can set core.hooksPath.
    "GIT_CONFIG_GLOBAL=/tmp/hooks.gitconfig git commit -m x",
    "GIT_CONFIG_SYSTEM=/tmp/hooks.gitconfig git push",
    "git -c include.path=/tmp/hooks.gitconfig commit -m x",
    "git -c includeIf.gitdir:/repo/.path=/tmp/hooks.gitconfig push",
    "git --config-env=include.path=CONFIG commit -m x",
    "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=include.path GIT_CONFIG_VALUE_0=/tmp/x git commit -m y",
    "git config --global include.path /tmp/hooks.gitconfig",
  ],
  allowed: [
    "git commit -m 'docs: never use --no-verify'",
    'git commit -m "never pass -n to commit"',
    "git commit -am 'fix'",
    "git commit -m wip -- --no-verify",
    "git push -n origin main",
    "git push origin main",
    "git log --oneline -n 5",
    "git config --get core.hooksPath",
    "git config core.editor vim",
    "grep -rn no-verify .",
    "cat .git/hooks/pre-commit",
    "LEFTHOOK_VERBOSE=1 git commit -m x",
    "git commit -F msg.txt",
    "git commit -m 'n'",
    "git rebase main",
    "pnpm check",
    "git commit --amend --no-edit",
    "git commit -S -m signed",
    "git commit -C HEAD",
    "git commit --message --no-verify",
    "git -c user.name=x -c core.editor=true rebase --continue",
    "GIT_CONFIG_GLOBAL=/dev/null git commit -m x",
    "GIT_CONFIG_NOSYSTEM=1 git commit -m x",
    "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=user.name GIT_CONFIG_VALUE_0=x git commit -m y",
    "git config --get include.path",
  ],
};
for (const command of cases.blocked) {
  expect(commandVerdict(command) !== null, `not blocked: ${command}`);
}
for (const command of cases.allowed) {
  const verdict = commandVerdict(command);
  expect(verdict === null, `blocked by mistake: ${command}${verdict === null ? "" : ` (${messageOf(verdict)})`}`);
}
expect(
  commandVerdict("git commit -m x", { LEFTHOOK: "0" }) !== null,
  "LEFTHOOK=0 in the agent's environment is not caught",
);
expect(
  commandVerdict("git status", { LEFTHOOK: "0" }) === null,
  "a read-only git command is blocked because of the agent's environment",
);
expect(
  commandVerdict("git rebase --continue", { GIT_CONFIG_GLOBAL: "/tmp/hooks.gitconfig" }) !== null,
  "GIT_CONFIG_GLOBAL in the agent's environment is not caught",
);
expect(commandVerdict("git ci -m x", {}, { ci: "commit -n" }) !== null, "an alias to commit -n is not expanded");
expect(commandVerdict("git sneak", {}, { sneak: "!git commit --no-verify" }) !== null, "a shell alias is not expanded");
expect(fileVerdict("/repo/.git/hooks/pre-commit") !== null, "a write into .git/hooks is not caught");
expect(fileVerdict(".git/config") !== null, "a write to .git/config is not caught");
expect(fileVerdict("src/room.actor.ts") === null, "an ordinary file write is blocked");

const form = /^[^.]+[^]*\. The git hooks are the gate: [^.]+\. Fix: [^.]+[^]*\.$/u;
for (const command of cases.blocked) {
  const verdict = commandVerdict(command);
  expect(
    verdict === null || form.test(messageOf(verdict)),
    `message not in <what>. <why>. Fix: <step>. form: ${verdict === null ? "" : messageOf(verdict)}`,
  );
}

const cwd = mkdtempSync(path.join(tmpdir(), "git-fence-"));
await run("git", ["init", "-q"], { cwd });
const hook = (agent, input) =>
  new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [cli, "--agent", agent],
      { cwd, env: { PATH: process.env.PATH } },
      (error, stdout, stderr) => {
        resolve({ code: error?.code ?? 0, stderr, stdout });
      },
    );
    child.stdin.end(JSON.stringify(input));
  });

const claudeBlocked = await hook("claude", {
  tool_input: { command: "git commit --no-verify -m x" },
  tool_name: "Bash",
  cwd,
});
const claudeDecision = JSON.parse(claudeBlocked.stdout || "{}").hookSpecificOutput;
expect(
  claudeBlocked.code === 0 && claudeDecision?.permissionDecision === "deny",
  `claude: not denied: ${claudeBlocked.stdout}`,
);
expect(form.test(claudeDecision?.permissionDecisionReason ?? ""), "claude: the reason is not in the fence form");
const claudeEdit = await hook("claude", {
  tool_input: { file_path: `${cwd}/.git/hooks/pre-commit` },
  tool_name: "Write",
  cwd,
});
expect(
  JSON.parse(claudeEdit.stdout || "{}").hookSpecificOutput?.permissionDecision === "deny",
  "claude: a Write into .git/hooks is not denied",
);
const claudeAllowed = await hook("claude", {
  tool_input: { command: "git commit -m 'never --no-verify'" },
  tool_name: "Bash",
  cwd,
});
expect(
  claudeAllowed.code === 0 && claudeAllowed.stdout === "",
  `claude: an allowed commit was answered: ${claudeAllowed.stdout}`,
);

const cursorBlocked = await hook("cursor", { command: "git push --no-verify", cwd });
const cursorAnswer = JSON.parse(cursorBlocked.stdout || "{}");
expect(
  cursorAnswer.permission === "deny" && form.test(cursorAnswer.agent_message ?? ""),
  `cursor: not denied: ${cursorBlocked.stdout}`,
);
const cursorAllowed = await hook("cursor", { command: "git push origin main", cwd });
expect(
  cursorAllowed.code === 0 && cursorAllowed.stdout === "",
  `cursor: an allowed push was answered: ${cursorAllowed.stdout}`,
);

const piBlocked = await hook("pi", { command: "LEFTHOOK=0 git commit -m x", cwd });
expect(
  piBlocked.code === 2 && form.test(piBlocked.stderr.trim()),
  `pi: not blocked: ${piBlocked.code} ${piBlocked.stderr}`,
);
const piAllowed = await hook("pi", { command: "git status", cwd });
expect(piAllowed.code === 0, "pi: git status was blocked");

await run("git", ["config", "alias.quick", "commit -n"], { cwd });
const aliased = await hook("cursor", { command: "git quick -m x", cwd });
expect(JSON.parse(aliased.stdout || "{}").permission === "deny", "the CLI does not expand the repo's git aliases");

const settings = JSON.parse(readFileSync(path.join(workspaceRoot, ".claude", "settings.json"), "utf8"));
const claudeCommands = settings.hooks.PreToolUse.map((entry) => [entry.matcher, entry.hooks[0].command]);
const viaShell = (command, input, env, cwd = workspaceRoot) =>
  new Promise((resolve) => {
    const child = execFile(
      "sh",
      ["-c", command],
      { cwd, env: { PATH: process.env.PATH, ...env } },
      (error, stdout, stderr) => {
        resolve({ code: error?.code ?? 0, stderr, stdout });
      },
    );
    child.stdin.end(JSON.stringify(input));
  });
for (const [matcher, command] of claudeCommands) {
  const input =
    matcher === "Bash"
      ? { tool_input: { command: "git commit -n -m x" } }
      : { tool_input: { file_path: ".git/config" } };
  const answer = await viaShell(command, input, { CLAUDE_PROJECT_DIR: workspaceRoot });
  expect(
    JSON.parse(answer.stdout || "{}").hookSpecificOutput?.permissionDecision === "deny",
    `.claude/settings.json ${matcher} hook does not deny`,
  );
}
const cursorConfig = JSON.parse(readFileSync(path.join(workspaceRoot, ".cursor", "hooks.json"), "utf8"));
const cursorWired = await viaShell(
  cursorConfig.hooks.beforeShellExecution[0].command,
  { command: "git commit --no-verify" },
  {},
);
expect(
  JSON.parse(cursorWired.stdout || "{}").permission === "deny",
  ".cursor/hooks.json beforeShellExecution hook does not deny",
);
const handlers = [];
const { default: piExtension } = await import(path.join(workspaceRoot, ".pi", "extensions", "git-fence.adapter.js"));
piExtension({ on: (event, handler) => handlers.push([event, handler]) });
const piHandler = handlers.find(([event]) => event === "tool_call")?.[1];
expect(
  piHandler?.({ input: { command: "git push --no-verify" }, toolName: "bash" })?.block === true,
  ".pi extension does not block git push --no-verify",
);
expect(
  piHandler?.({ input: { path: ".git/hooks/pre-push" }, toolName: "write" })?.block === true,
  ".pi extension does not block a write into .git/hooks",
);
expect(
  piHandler?.({ input: { command: "git status" }, toolName: "bash" }) === undefined,
  ".pi extension blocks git status",
);

const stranded = mkdtempSync(path.join(tmpdir(), "git-fence-missing-"));
writeFileSync(path.join(stranded, "package.json"), JSON.stringify({ type: "module" }));
for (const [matcher, command] of claudeCommands) {
  const answer = await viaShell(
    command,
    { tool_input: { command: "git status" } },
    { CLAUDE_PROJECT_DIR: stranded },
    stranded,
  );
  expect(
    answer.code === 2 && answer.stderr.includes("git-fence could not run, so this call is refused"),
    `.claude/settings.json ${matcher} hook lets a call through when git-fence is missing: ${answer.code} ${answer.stderr}`,
  );
}
const cursorHook = cursorConfig.hooks.beforeShellExecution[0];
expect(cursorHook.failClosed === true, ".cursor/hooks.json beforeShellExecution hook does not set failClosed");
const cursorStranded = await viaShell(cursorHook.command, { command: "git status" }, {}, stranded);
expect(
  cursorStranded.code !== 0,
  ".cursor/hooks.json hook exits 0 when git-fence is missing, so Cursor would allow the call",
);
mkdirSync(path.join(stranded, ".pi", "extensions"), { recursive: true });
copyFileSync(
  path.join(workspaceRoot, ".pi", "extensions", "git-fence.adapter.js"),
  path.join(stranded, ".pi", "extensions", "git-fence.adapter.js"),
);
const strandedHandlers = [];
const { default: strandedExtension } = await import(path.join(stranded, ".pi", "extensions", "git-fence.adapter.js"));
strandedExtension({ on: (event, handler) => strandedHandlers.push([event, handler]) });
const strandedAnswer = strandedHandlers.find(([event]) => event === "tool_call")?.[1]?.({
  input: { command: "git status" },
  toolName: "bash",
});
expect(
  strandedAnswer?.block === true && strandedAnswer.reason.includes("so this call is refused"),
  `.pi extension lets a call through when git-fence is missing: ${JSON.stringify(strandedAnswer)}`,
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  `git fence: ${cases.blocked.length} blocked and ${cases.allowed.length} allowed commands, the Claude Code, Cursor and Pi answers, and this repo's three hook configs, which refuse when git-fence is missing`,
);
