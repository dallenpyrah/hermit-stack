#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { commandVerdict, fileVerdict, messageOf } from "./git-fence.pure.mjs";

const agents = ["claude", "cursor", "pi"];
const agent = process.argv[process.argv.indexOf("--agent") + 1];
if (!agents.includes(agent)) {
  console.error(`usage: git-fence --agent <${agents.join("|")}> < hook-input.json`);
  process.exit(1);
}

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const command = input.tool_input?.command ?? input.command;
const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? input.file_path;
const cwd = input.cwd ?? process.cwd();
const aliases = (() => {
  try {
    return Object.fromEntries(
      execFileSync("git", ["config", "--get-regexp", "^alias\\."], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => [line.slice("alias.".length, line.indexOf(" ")), line.slice(line.indexOf(" ") + 1)]),
    );
  } catch {
    return {};
  }
})();

const verdict =
  typeof command === "string"
    ? commandVerdict(command, process.env, aliases)
    : typeof filePath === "string"
      ? fileVerdict(filePath)
      : null;
if (verdict === null) {
  process.exit(0);
}
const message = messageOf(verdict);
if (agent === "claude") {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: message,
      },
    }),
  );
} else if (agent === "cursor") {
  console.log(JSON.stringify({ permission: "deny", user_message: message, agent_message: message }));
} else {
  console.error(message);
  process.exit(2);
}
