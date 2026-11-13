# Git fence

`src/fence/git-fence.cli.mjs` (`git-fence`) is the policy every agent hook runs before a shell command or a file write. It keeps an agent from skipping or switching off the lefthook hooks, which run the format, secrets, typecheck and lint gate on each commit. A refusal reads `<what>. <why>. Fix: <step>.`

## Where it is wired

| Agent       | Config                                | Hook                                                                       | Answer                                                            |
| ----------- | ------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Claude Code | `.claude/settings.json`               | `PreToolUse` on `Bash` and on `Edit`, `Write`, `MultiEdit`, `NotebookEdit` | `permissionDecision: "deny"` with the message                     |
| Cursor      | `.cursor/hooks.json`                  | `beforeShellExecution`                                                     | `permission: "deny"`, with the message for the agent and the user |
| Pi          | `.pi/extensions/git-fence.adapter.js` | `tool_call` on `bash`, `edit` and `write`                                  | `{ block: true, reason }`                                         |

Each config sits at the repo root. Claude Code and Pi load the script through the `@repo/rules/git-fence` export, which the root `package.json` links, and Cursor runs `tools/rules/src/fence/git-fence.cli.mjs` by path. Upstream also wires an Amp plugin (`git-fence.adapter.js` in its Amp plugins folder); hermit-stack does not have one yet.

Each hook fails closed. When the script can't be found or exits with an unexpected code, the Claude Code command exits 2, the Cursor hook sets `failClosed: true`, and the Pi extension returns `{ block: true }`. Each one refuses the call with `git-fence could not run, so this call is refused. Fix: run pnpm install --force …`. An agent never runs the call unchecked.

## What it refuses

- `--no-verify` on any git command, including abbreviations git accepts such as `--no-verif`, and `git commit -n` alone or in a cluster such as `-anm`. `git push -n` is a dry run and passes.
- A `core.hooksPath` change through `git -c` or `--config-env` before any subcommand, `git config` (set or unset) or a `GIT_CONFIG_*` variable (`GIT_CONFIG_PARAMETERS`, `GIT_CONFIG_COUNT` with its `KEY_n`).
- Pointing git at another config file, which can set `core.hooksPath`: `include.path` or `includeIf.<condition>.path` set in any of those ways, and `GIT_CONFIG_GLOBAL` or `GIT_CONFIG_SYSTEM` set to anything but `/dev/null`.
- `LEFTHOOK=0` or `false`, `LEFTHOOK_BIN`, `LEFTHOOK_CONFIG`, `LEFTHOOK_EXCLUDE` and `HUSKY=0`, whether set on the command, exported, or already in the agent's environment when it runs a commit, push, merge, rebase, pull, am, revert or cherry-pick.
- `lefthook uninstall`, and `rm`, `mv`, `cp`, `ln`, `chmod`, `tee`, `truncate`, `sed -i` or a redirect into `.git/hooks` or `.git/config`, plus agent file writes there.

It reads through `&&`, `||`, `;`, pipes, `sh -c` and the other shells, `eval`, `$(...)` and backticks in double quotes, wrappers such as `env`, `sudo` and `xargs`, and the repo's git aliases, shell aliases included.

## What it cannot close

- Git run from a script file, a variable (`$CMD`), a decoded string or another language (`node -e`, `python -c`): the hook sees the outer command only.
- An agent with no hook support, Amp included until it has a plugin here, and people. `AGENTS.md` forbids `--no-verify` for them instead.
- Cursor file edits: Cursor's file hooks observe edits after the fact and cannot refuse them, so a Cursor agent can still write `.git/config`.
- Hooks a person turns off in their agent's settings.
