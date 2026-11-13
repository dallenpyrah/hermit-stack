import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const fix = "Fix: run pnpm install --force in this repo.";

const fenceOf = () => {
  try {
    return { path: createRequire(new URL("../../package.json", import.meta.url)).resolve("@repo/rules/git-fence") };
  } catch (error) {
    return { reason: error.message };
  }
};

const ask = (input) => {
  const fence = fenceOf();
  if (fence.path === undefined) {
    return { block: true, reason: `git-fence could not be found, so this call is refused: ${fence.reason}. ${fix}` };
  }
  const { error, status, stderr } = spawnSync("node", [fence.path, "--agent", "pi"], {
    encoding: "utf8",
    input: JSON.stringify(input),
  });
  if (status === 0) {
    return undefined;
  }
  if (status === 2) {
    return { block: true, reason: stderr.trim() };
  }
  const why = error?.message ?? `exit ${status}: ${stderr.trim()}`;
  return { block: true, reason: `git-fence could not run (${why}), so this call is refused. ${fix}` };
};

export default function gitFence(pi) {
  pi.on("tool_call", (event) => {
    if (event.toolName === "bash") {
      return ask({ command: event.input.command, cwd: process.cwd() });
    }
    if (event.toolName === "edit" || event.toolName === "write") {
      return ask({ file_path: event.input.path });
    }
    return undefined;
  });
}
