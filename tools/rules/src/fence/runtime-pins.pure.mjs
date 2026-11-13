const runtimes = ["node", "bun"];

const toolsSection = (toml) => toml.split(/^\[/mu).find((section) => section.startsWith("tools]")) ?? "";

const pinsOf = (toml) =>
  Object.fromEntries(
    [...toolsSection(toml).matchAll(/^(\w+)\s*=\s*"([^"]+)"/gmu)]
      .filter(([, name]) => runtimes.includes(name))
      .map(([, name, version]) => [name, version]),
  );

const matches = (pin, version) => version === pin || version.startsWith(`${pin}.`);

const why = "A runtime test on an unpinned runtime proves nothing about the pinned one";
const fix = "run pnpm check, which runs every task through `mise exec`, or activate mise in this shell";

const verdictOf = (name, pin, seen) => {
  if (seen === undefined) {
    return [`${name} is not on PATH, but mise.toml pins ${pin}. ${why}. Fix: ${fix}.`];
  }
  if (matches(pin, seen.version)) {
    return [];
  }
  return [`${name} ${seen.version} runs from ${seen.path}, but mise.toml pins ${pin}. ${why}. Fix: ${fix}.`];
};

const verdictsOf = (pins, seen) => Object.entries(pins).flatMap(([name, pin]) => verdictOf(name, pin, seen[name]));

export { pinsOf, verdictsOf };
