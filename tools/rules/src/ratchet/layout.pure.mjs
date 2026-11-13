const folderCap = 10;
const codeFile = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/u;
const testFile = /\.test\.(?:ts|tsx|mts|mjs|js)$/u;
const supportFile = /\.(?:fake|workload)\.(?:ts|tsx|mts|mjs|js)$/u;
const outOfScope = /(?:^|\/)(?:eval|fixtures|node_modules|dist)\//u;
const benchFolder = /^bench\//u;
const testAspect = /\.(?:portable|browser|workerd|bundle|types|live|composed)$/u;
const why = "Tests live in tests/ and mirror src/ file for file, so a reader finds a file's tests by its path";

const baseOf = (file) => file.slice(file.lastIndexOf("/") + 1);

const folderOf = (file) => (file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ".");

const packagesOf = (files) =>
  files
    .filter((file) => baseOf(file) === "package.json")
    .map((file) => folderOf(file))
    .map((directory) => (directory === "." ? "" : `${directory}/`))
    .toSorted((left, right) => right.length - left.length);

const packageOf = (packages, file) => packages.find((prefix) => file.startsWith(prefix)) ?? "";

const inBench = (packages, file) => benchFolder.test(file.slice(packageOf(packages, file).length));

const withoutExtension = (file) => file.replace(/\.[^./]+$/u, "");

const withoutRole = (file) => file.replace(/\.[^./]+\.[^./]+$/u, "");

const roleOf = (file) => baseOf(file).split(".").at(-2) ?? "";

const mirrorKey = (prefix) => `tests outside the mirror in ${prefix === "" ? "." : prefix.slice(0, -1)}`;

const folderKey = (folder) => `code files in ${folder} (cap ${folderCap})`;

const withRole = (file) =>
  /\.[a-z-]+\.test\.[^./]+$/u.test(file) ? file : file.replace(/\.test\.([^./]+)$/u, ".<role>.test.$1");

const misplacedTest = (prefix, relative) => {
  const expected = relative.startsWith("src/")
    ? `${prefix}tests/${withRole(relative.slice("src/".length))}`
    : `${prefix}tests/<path of the src/ file it tests>.<role>.test.ts`;

  return `${prefix}${relative} is a test outside tests/. ${why}. Fix: move it to ${expected}, named for the one src/ file it tests, and import that file as #src/<path>, with no extension, through the package.json's "#src/*" import, which maps to ./src/*.ts.`;
};

const orphanTest = (prefix, relative, stem) =>
  `${prefix}${relative} has no source file ${prefix}src/${stem}.<ext> to test. ${why}, and a test is named for the one file it tests. Fix: rename it to tests/<path>/<name>.<role>.test.ts, or <name>.<role>.<aspect>.test.ts with an aspect from the README's list, after the src/ file it tests.`;

const misplacedSupport = (prefix, relative) =>
  `${prefix}${relative} is a ${roleOf(relative)} outside tests/. ${why}, and fakes and workloads are test support. Fix: move it to ${prefix}tests/${relative.replace(/^src\//u, "")}.`;

const orphanSupport = (prefix, relative, name) =>
  `${prefix}${relative} names no source file ${prefix}src/${name}.<role>.<ext>. ${why}, so a ${roleOf(relative)} has the path and name of the src/ file it stands in for or drives. Fix: rename it after that file, keeping only its role.`;

const isSource = (file) => !testFile.test(file) && !supportFile.test(file);

const mirrorViolation = (sources, prefix, relative) => {
  if (testFile.test(relative)) {
    if (!relative.startsWith("tests/")) {
      return misplacedTest(prefix, relative);
    }
    const stem = relative.slice("tests/".length).replace(testFile, "").replace(testAspect, "");
    const tested = sources.some((file) => isSource(file) && withoutExtension(file) === `${prefix}src/${stem}`);
    return tested ? undefined : orphanTest(prefix, relative, stem);
  }
  if (supportFile.test(relative)) {
    if (!relative.startsWith("tests/")) {
      return misplacedSupport(prefix, relative);
    }
    const name = withoutRole(relative.slice("tests/".length));
    const driven = sources.some((file) => isSource(file) && withoutRole(file) === `${prefix}src/${name}`);
    return driven ? undefined : orphanSupport(prefix, relative, name);
  }
  return undefined;
};

const layoutOf = (files) => {
  const packages = packagesOf(files);
  const sources = files.filter(
    (file) => codeFile.test(file) && !file.endsWith(".d.ts") && !outOfScope.test(file) && !inBench(packages, file),
  );
  const details = {};
  const folders = {};

  for (const file of sources) {
    const prefix = packageOf(packages, file);
    const relative = file.slice(prefix.length);
    const violation = mirrorViolation(sources, prefix, relative);
    if (violation !== undefined) {
      details[mirrorKey(prefix)] = [...(details[mirrorKey(prefix)] ?? []), violation];
    } else if (relative.startsWith("src/") && isSource(relative)) {
      const folder = folderOf(file);
      folders[folder] = (folders[folder] ?? 0) + 1;
    }
  }

  const crowded = Object.entries(folders).filter(([, count]) => count > folderCap);
  for (const [folder, count] of crowded) {
    details[folderKey(folder)] = [
      `${folder} holds ${count} code files, over the cap of ${folderCap} for one folder. A folder named for a domain tells a reader where to look, and a flat list of files doesn't. Fix: group its files into subfolders named for nouns of the domain, such as command/ or migration/.`,
    ];
  }

  const counts = Object.fromEntries([
    ...Object.entries(details)
      .filter(([key]) => key.startsWith("tests outside the mirror in "))
      .map(([key, lines]) => [key, lines.length]),
    ...crowded.map(([folder, count]) => [folderKey(folder), count]),
  ]);

  return { counts, details };
};

export { folderCap, layoutOf };
