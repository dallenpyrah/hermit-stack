const lineCap = 500;

/**
 * Files the cap doesn't read: lockfiles, patches, `.gen` output, vendored and
 * built code (ADR 0006), the generated baselines a gate diffs (an OpenAPI
 * spec, actor contracts, mutant lists) and package manifests, whose exports
 * map grows with the package's modules. A person writes none of them by hand.
 */
const uncapped = [
  /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|bun\.lockb?|yarn\.lock)$/u,
  /\.patch$/u,
  /\.gen\.[^/]+$/u,
  /(?:^|\/)(?:vendor|node_modules|dist)\//u,
  /(?:^|\/)(?:src|tests)\/oxlint\/anti-slop\//u,
  /(?:^|\/)(?:openapi|contracts|package)\.json$/u,
  /(?:^|\/)mutants\.(?:baseline|equivalent)\.json$/u,
];

const sourceFile = /\.[cm]?[jt]sx?$/u;

const directive = /(?:oxlint|eslint)-disable|@ts-(?:ignore|expect-error|nocheck)/u;

const isText = (text) => !text.includes("\0");

const linesOf = (text) => {
  if (text === "") {
    return 0;
  }
  const breaks = text.split("\n").length - 1;
  return text.endsWith("\n") ? breaks : breaks + 1;
};

const isCapped = (file) => !uncapped.some((pattern) => pattern.test(file));

/** The capped text files of `files` (each `{ path, text }`) over 500 lines, longest first. */
const overCap = (files) =>
  files
    .filter(({ path, text }) => isCapped(path) && isText(text) && linesOf(text) > lineCap)
    .map(({ path, text }) => ({ lines: linesOf(text), path }))
    .toSorted((left, right) => right.lines - left.lines || left.path.localeCompare(right.path));

const suppressionsIn = ({ path, text }) =>
  sourceFile.test(path) && isCapped(path)
    ? text
        .split("\n")
        .flatMap((line, index) => (directive.test(line) ? [{ line: index + 1, path, text: line.trim() }] : []))
    : [];

const capWhy = `A file over ${lineCap} lines holds more than one idea, and a reader or an agent has to page through it`;
const suppressionWhy =
  "An inline suppression turns a rule off where no review of the shared config sees it, so the rule stops meaning what it says";

/** One `<what>. <why>. Fix: <step>.` refusal per long file and per inline suppression in `files`. */
const verdictsOf = (files) => [
  ...overCap(files).map(
    ({ lines, path }) =>
      `${path} has ${lines} lines, over the cap of ${lineCap}. ${capWhy}. Fix: split it into files named for the parts of its domain.`,
  ),
  ...files
    .flatMap(suppressionsIn)
    .map(
      ({ line, path, text }) =>
        `${path}:${line} turns a rule off inline (${text}). ${suppressionWhy}. Fix: change the code so the rule passes, or turn the rule off in the base config of @repo/rules/oxlint with its reason.`,
    ),
];

export { lineCap, linesOf, overCap, verdictsOf };
