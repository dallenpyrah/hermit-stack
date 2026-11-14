const gate =
  "The git hooks are the gate: lefthook formats, scans for secrets, typechecks and lints each commit, so skipping them lands unchecked work";

const reasons = {
  noVerify: (command) => ({
    what: `\`${command}\` skips the git hooks`,
    fix: "run the same command without --no-verify or -n and fix what the hook reports",
  }),
  hooksPath: () => ({
    what: "Changing core.hooksPath, or pointing git at another config file that can change it, points git away from the lefthook hooks",
    fix: "leave core.hooksPath and git's config files alone; pnpm install runs lefthook install, which manages the hooks",
  }),
  variable: (name) => ({
    what: `${name} turns off or redirects the lefthook hooks`,
    fix: `drop ${name} and let the hooks run`,
  }),
  hookFiles: (target) => ({
    what: `Writing ${target} by hand can remove or replace the lefthook hooks`,
    fix: "repair hooks with pnpm install, which runs lefthook install",
  }),
  uninstall: () => ({
    what: "`lefthook uninstall` removes the git hooks",
    fix: "keep the hooks installed; pnpm install puts them back",
  }),
};

const messageOf = ({ what, fix }) => `${what}. ${gate}. Fix: ${fix}.`;

const hookVariables = {
  HUSKY: (value) => value === "0",
  LEFTHOOK: (value) => value === "0" || value.toLowerCase() === "false",
  LEFTHOOK_BIN: () => true,
  LEFTHOOK_CONFIG: () => true,
  LEFTHOOK_EXCLUDE: () => true,
};
const configRedirect = /core\.hookspath|include(?:if\.[^=']*)?\.path/iu;
const variableVerdict = (name, value) => {
  if (Object.hasOwn(hookVariables, name) && hookVariables[name](value)) {
    return reasons.variable(`${name}=${value}`);
  }
  if (name.startsWith("GIT_CONFIG_") && configRedirect.test(value)) {
    return reasons.variable(name);
  }
  if ((name === "GIT_CONFIG_GLOBAL" || name === "GIT_CONFIG_SYSTEM") && value !== "/dev/null") {
    return reasons.variable(`${name}=${value}`);
  }
  return null;
};

const separators = ["&&", "||", "$(", ";", "|", "&", "(", ")", "`", "{", "}"];
const tokenize = (text) => {
  const tokens = [];
  let value = "";
  let started = false;
  let nested = false;
  const push = () => {
    if (started) {
      tokens.push({ nested, value });
    }
    value = "";
    started = false;
    nested = false;
  };
  for (let index = 0; index < text.length;) {
    const char = text[index];
    if (char === "'") {
      const end = text.indexOf("'", index + 1);
      const stop = end === -1 ? text.length : end;
      value += text.slice(index + 1, stop);
      started = true;
      index = stop + 1;
    } else if (char === '"') {
      let cursor = index + 1;
      while (cursor < text.length && text[cursor] !== '"') {
        if (text[cursor] === "\\") {
          value += text[cursor + 1] ?? "";
          cursor += 2;
        } else {
          nested ||= text.startsWith("$(", cursor) || text[cursor] === "`";
          value += text[cursor];
          cursor += 1;
        }
      }
      started = true;
      index = cursor + 1;
    } else if (char === "\\") {
      value += text[index + 1] ?? "";
      started = true;
      index += 2;
    } else if (char === "\n") {
      push();
      tokens.push({ nested: false, separator: true, value: ";" });
      index += 1;
    } else if (/\s/u.test(char)) {
      push();
      index += 1;
    } else {
      const separator = separators.find((candidate) => text.startsWith(candidate, index));
      if (separator === undefined) {
        value += char;
        started = true;
        index += 1;
      } else {
        push();
        tokens.push({ nested: false, separator: true, value: ";" });
        index += separator.length;
      }
    }
  }
  push();
  return tokens;
};

const segmentsOf = (tokens) =>
  tokens.reduce(
    (segments, token) => {
      if (token.separator === true) {
        segments.push([]);
      } else {
        segments.at(-1).push(token);
      }
      return segments;
    },
    [[]],
  );

const assignment = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/su;
const wrappers = new Set(["builtin", "command", "exec", "nice", "nohup", "sudo", "time", "timeout", "xargs"]);
const shells = new Set(["bash", "dash", "ksh", "sh", "zsh"]);
const hookRunning = new Set(["am", "commit", "merge", "pull", "push", "rebase", "revert", "cherry-pick"]);
const gitPaths = /(^|\/)\.git\/(hooks(\/|$)|config$)/u;
const fileWriters = new Set(["chmod", "cp", "ln", "mv", "rm", "tee", "truncate", "unlink"]);
const gitValueOptions = new Set(["-C", "-c", "--config-env", "--exec-path", "--git-dir", "--namespace", "--work-tree"]);
const commitValueLetters = new Set(["C", "F", "c", "m", "t"]);
const commitOptionalLetters = new Set(["S", "u"]);
const commitValueOptions = new Set([
  "--author",
  "--cleanup",
  "--date",
  "--file",
  "--fixup",
  "--message",
  "--pathspec-from-file",
  "--reedit-message",
  "--reuse-message",
  "--squash",
  "--template",
  "--trailer",
]);
const isNoVerify = (arg) => arg.length >= "--no-veri".length && "--no-verify".startsWith(arg);
const isHooksPathKey = (text) => /^(?:core\.hookspath|include(?:if\..*)?\.path)(=|$)/iu.test(text);
const baseName = (word) => word.slice(word.lastIndexOf("/") + 1);

const commitVerdict = (args) => {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      return null;
    }
    if (isNoVerify(arg)) {
      return reasons.noVerify(`git commit ${arg}`);
    }
    if (commitValueOptions.has(arg)) {
      index += 1;
    } else if (/^-[^-]/u.test(arg)) {
      for (let letter = 1; letter < arg.length; letter += 1) {
        const char = arg[letter];
        if (char === "n") {
          return reasons.noVerify(`git commit ${arg}`);
        }
        if (commitValueLetters.has(char)) {
          index += letter === arg.length - 1 ? 1 : 0;
          break;
        }
        if (commitOptionalLetters.has(char)) {
          break;
        }
      }
    }
  }
  return null;
};

const configVerdict = (args) => {
  const reads = args.some((arg) => ["--get", "--get-all", "--get-regexp", "--list", "-l", "get", "list"].includes(arg));
  return !reads && args.some(isHooksPathKey) ? reasons.hooksPath() : null;
};

const gitVerdict = (args, environment, aliases, depth) => {
  let index = 0;
  while (index < args.length && args[index].startsWith("-")) {
    const option = args[index];
    const [name, attached] = option.startsWith("--") ? option.split(/=(.*)/su) : [option, undefined];
    const value = attached ?? (option.startsWith("-c") && option.length > 2 ? option.slice(2) : undefined);
    const takesValue = gitValueOptions.has(name) && value === undefined;
    const configured = takesValue ? (args[index + 1] ?? "") : (value ?? "");
    if ((name === "-c" || name.startsWith("-c") || name === "--config-env") && isHooksPathKey(configured)) {
      return reasons.hooksPath();
    }
    index += takesValue ? 2 : 1;
  }
  const subcommand = args[index];
  if (subcommand === undefined) {
    return null;
  }
  const rest = args.slice(index + 1);
  const alias = aliases[subcommand];
  if (alias !== undefined && depth < 5) {
    return alias.startsWith("!")
      ? commandVerdict(`${alias.slice(1)} ${rest.join(" ")}`, environment, aliases, depth + 1)
      : gitVerdict([...tokenize(alias).map((token) => token.value), ...rest], environment, aliases, depth + 1);
  }
  if (hookRunning.has(subcommand)) {
    const inherited = Object.entries(environment)
      .map(([name, value]) => variableVerdict(name, value))
      .find((verdict) => verdict !== null);
    if (inherited !== undefined) {
      return inherited;
    }
  }
  if (subcommand === "commit") {
    return commitVerdict(rest);
  }
  if (subcommand === "config") {
    return configVerdict(rest);
  }
  const skipping = rest.slice(0, rest.includes("--") ? rest.indexOf("--") : rest.length).find(isNoVerify);
  return skipping === undefined ? null : reasons.noVerify(`git ${subcommand} ${skipping}`);
};

const segmentVerdict = (words, nestedWords, environment, aliases, depth) => {
  const scoped = { ...environment };
  let index = 0;
  for (; index < words.length; index += 1) {
    const match = assignment.exec(words[index]);
    if (match !== null) {
      const verdict = variableVerdict(match[1], match[2]);
      if (verdict !== null) {
        return verdict;
      }
      scoped[match[1]] = match[2];
    } else if (
      wrappers.has(words[index]) ||
      words[index] === "env" ||
      (index > 0 &&
        words[index].startsWith("-") &&
        ["env", "xargs", "sudo", "timeout", "nice"].includes(words[index - 1]))
    ) {
      continue;
    } else {
      break;
    }
  }
  const [word, ...args] = words.slice(index);
  if (word === undefined) {
    return null;
  }
  const program = baseName(word);
  const redirect = words.findIndex((token) => /^\d?>{1,2}/u.test(token));
  if (redirect !== -1) {
    const target = words[redirect].replace(/^\d?>{1,2}/u, "") || words[redirect + 1] || "";
    if (gitPaths.test(target)) {
      return reasons.hookFiles(target);
    }
  }
  if (program === "export") {
    return (
      args
        .map((arg) => assignment.exec(arg))
        .filter((match) => match !== null)
        .map((match) => variableVerdict(match[1], match[2]))
        .find((verdict) => verdict !== null) ?? null
    );
  }
  if (shells.has(program)) {
    const flag = args.findIndex((arg) => /^-[a-z]*c[a-z]*$/u.test(arg));
    return flag === -1 || args[flag + 1] === undefined
      ? null
      : commandVerdict(args[flag + 1], scoped, aliases, depth + 1);
  }
  if (program === "eval") {
    return commandVerdict(args.join(" "), scoped, aliases, depth + 1);
  }
  if (program === "lefthook" && args[0] === "uninstall") {
    return reasons.uninstall();
  }
  if (fileWriters.has(program) || (program === "sed" && args.some((arg) => arg.startsWith("-i")))) {
    const target = args.find((arg) => gitPaths.test(arg));
    if (target !== undefined) {
      return reasons.hookFiles(target);
    }
  }
  if (program === "git") {
    const verdict = gitVerdict(args, scoped, aliases, depth);
    if (verdict !== null) {
      return verdict;
    }
  }
  return (
    nestedWords.map((text) => commandVerdict(text, scoped, aliases, depth + 1)).find((verdict) => verdict !== null) ??
    null
  );
};

const commandVerdict = (command, environment = {}, aliases = {}, depth = 0) => {
  if (depth > 5) {
    return null;
  }
  return (
    segmentsOf(tokenize(command))
      .map((segment) =>
        segmentVerdict(
          segment.map((token) => token.value),
          segment.filter((token) => token.nested).map((token) => token.value),
          environment,
          aliases,
          depth,
        ),
      )
      .find((verdict) => verdict !== null) ?? null
  );
};

const fileVerdict = (filePath) => (gitPaths.test(filePath.replaceAll("\\", "/")) ? reasons.hookFiles(filePath) : null);

export { commandVerdict, fileVerdict, messageOf };
