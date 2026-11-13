const sum = (counts) => counts.reduce((total, count) => total + count, 0);

const severityOf = (value) => (Array.isArray(value) ? value[0] : value);
const isOff = (value) => severityOf(value) === "off" || severityOf(value) === 0;

const definitionServices = (config) => {
  const setting = config.rules?.["structure/role-imports"];
  return (Array.isArray(setting) ? (setting[1]?.definitionServices ?? []) : []).length;
};

const oxlintCounts = (file, config) => ({
  ...(definitionServices(config) > 0
    ? { [`${file} role-imports definition services`]: definitionServices(config) }
    : {}),
  [`${file} rules off`]: Object.values(config.rules ?? {}).filter(isOff).length,
  [`${file} override rules per glob`]: sum(
    (config.overrides ?? []).map(
      (override) => (override.files ?? []).length * Object.keys(override.rules ?? {}).length,
    ),
  ),
  [`${file} ignore patterns`]: (config.ignorePatterns ?? []).length,
});

const sizeOf = (value) => {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value !== null && typeof value === "object") {
    return sum(Object.values(value).map(sizeOf));
  }
  return value === false || value === undefined ? 0 : 1;
};
const knipExceptions = (config) =>
  sum(
    [config, ...Object.values(config.workspaces ?? {})].flatMap((scope) =>
      Object.entries(scope)
        .filter(([key]) => key === "entry" || key.startsWith("ignore"))
        .map(([, value]) => sizeOf(value)),
    ),
  );

const patchedDependencies = (workspaceYaml, packageJson) => {
  const lines = workspaceYaml.split("\n");
  const start = lines.findIndex((line) => line.trimEnd() === "patchedDependencies:");
  const rest = start === -1 ? [] : lines.slice(start + 1);
  const end = rest.findIndex((line) => line.trim() !== "" && !/^\s/u.test(line));
  const listed = (end === -1 ? rest : rest.slice(0, end)).filter((line) => /^\s+\S/u.test(line)).length;
  return listed + Object.keys(packageJson.pnpm?.patchedDependencies ?? {}).length;
};

const trustPolicyExceptions = (workspace) => {
  const entries = workspace?.trustPolicyExclude ?? [];
  if (!Array.isArray(entries) || entries.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw new Error("trustPolicyExclude must be a list of non-empty package selectors");
  }
  return entries.length > 0 ? { "trust policy exceptions": entries.length } : {};
};

const jsonc = (text) =>
  JSON.parse(
    text
      .replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[^]*?\*\//gu, (_match, string) => string ?? "")
      .replace(/("(?:[^"\\]|\\.)*")|,(\s*[}\]])/gu, (_match, string, close) => string ?? close),
  );

const strictChecks = [
  "strict",
  "noImplicitAny",
  "strictNullChecks",
  "strictFunctionTypes",
  "strictBindCallApply",
  "strictPropertyInitialization",
  "strictBuiltinIteratorReturn",
  "noImplicitThis",
  "useUnknownInCatchVariables",
  "alwaysStrict",
  "noUncheckedIndexedAccess",
  "exactOptionalPropertyTypes",
  "noImplicitOverride",
  "noImplicitReturns",
  "noFallthroughCasesInSwitch",
  "noUnusedLocals",
  "noUnusedParameters",
  "noPropertyAccessFromIndexSignature",
];
const allowances = ["allowUnreachableCode", "allowUnusedLabels"];
const quiet = new Set(["off", "suggestion", "message"]);
const quietIn = (severities) => Object.values(severities ?? {}).filter((severity) => quiet.has(severity)).length;

const tsconfigCounts = (file, config) => {
  const options = config.compilerOptions ?? {};
  const service = (options.plugins ?? []).find((plugin) => plugin.name === "@effect/language-service") ?? {};
  const counts = {
    [`${file} diagnostics off`]:
      strictChecks.filter((check) => options[check] === false).length +
      allowances.filter((allowance) => options[allowance] === true).length +
      (service.ignoreEffectWarningsInTscExitCode === true ? 1 : 0) +
      quietIn(service.diagnosticSeverity),
    [`${file} override diagnostics per glob`]: sum(
      (service.overrides ?? []).map(
        (override) => (override.include ?? []).length * quietIn(override.options?.diagnosticSeverity),
      ),
    ),
    [`${file} allowed unstable APIs`]: (service.allowedUnstableApis ?? []).length,
  };
  return Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0));
};

const directive = /(?:oxlint|eslint)-disable|@ts-(?:ignore|expect-error|nocheck)/gu;
const inlineSuppressions = (sources) => sum(sources.map((source) => source.match(directive)?.length ?? 0));

const measuredCounts = (file, text, counted) => {
  const why = "A measured count comes from the JSON object of whole numbers its task writes";
  if (text === undefined) {
    return {
      counts: {},
      errors: [
        `--counts ${file} names no file. ${why}, before the ratchet reads it. Fix: run the task that writes ${file} first.`,
      ],
    };
  }
  const parsed = JSON.parse(text);
  const entries = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? Object.entries(parsed) : [];
  const errors = [
    ...(entries.length === 0
      ? [`--counts ${file} holds no counts. ${why}. Fix: write { "<name>": <count> } to ${file}.`]
      : []),
    ...entries.flatMap(([name, count]) => [
      ...(Number.isSafeInteger(count) && count >= 0
        ? []
        : [`"${name}" in ${file} is ${JSON.stringify(count)}. ${why}. Fix: write a whole number of 0 or more.`]),
      ...(Object.hasOwn(counted, name)
        ? [
            `"${name}" in ${file} is already counted. ${why}, and two counts with one name hide each other. Fix: rename it.`,
          ]
        : []),
    ]),
  ];
  return { counts: Object.fromEntries(entries), errors };
};

const mutantEntries = (lists) => sum(lists.map((list) => Object.keys(list).length));

const why = "Ratchets may only go down, so the count in ratchets.json is the most this repo allows";
const verdictsOf = (baseline, counts) => [
  ...Object.entries(counts).flatMap(([name, count]) => {
    if (!Object.hasOwn(baseline, name)) {
      return [`"${name}" is ${count} and has no baseline. ${why}. Fix: add "${name}": ${count} to ratchets.json.`];
    }
    if (count > baseline[name]) {
      return [
        `"${name}" grew from ${baseline[name]} to ${count}. ${why}. Fix: remove what you added, or raise "${name}" to ${count} in ratchets.json in the same commit and say why in its message.`,
      ];
    }
    if (count < baseline[name]) {
      return [
        `"${name}" dropped from ${baseline[name]} to ${count}. ${why}, and a stale baseline lets the count grow back. Fix: lower "${name}" to ${count} in ratchets.json in the same commit.`,
      ];
    }
    return [];
  }),
  ...Object.keys(baseline)
    .filter((name) => !Object.hasOwn(counts, name))
    .map(
      (name) =>
        `ratchets.json counts "${name}", which this repo no longer has. ${why}, so every entry must match something. Fix: delete "${name}" from ratchets.json.`,
    ),
];

export {
  inlineSuppressions,
  jsonc,
  knipExceptions,
  measuredCounts,
  mutantEntries,
  oxlintCounts,
  patchedDependencies,
  tsconfigCounts,
  trustPolicyExceptions,
  verdictsOf,
};
