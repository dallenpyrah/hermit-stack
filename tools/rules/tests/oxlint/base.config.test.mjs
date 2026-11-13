import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { domainStructure } from "../../dist/oxlint/domain.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const fixtures = path.join(root, "fixtures");
const baseConfig = path.join(root, "fixtures/base-fixtures.config.ts");
const plugins = {
  base: null,
  "effect-machine": "node_modules/@typeonce/oxlint-plugin-effect-machine/dist/index.js",
  structure: "dist/oxlint/structure.mjs",
  taste: "dist/oxlint/taste.mjs",
};
const oxlint = path.join(root, "node_modules/.bin/oxlint");
const work = mkdtempSync(path.join(tmpdir(), "rules-fixtures-"));
const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
let failures = 0;
let checked = 0;
for (const [plugin, entry] of Object.entries(plugins)) {
  for (const directory of readdirSync(path.join(fixtures, plugin))) {
    const rule = directory.split("@")[0];
    const relatedRules =
      plugin === "base" && rule === "prefer-strict-boolean-matchers"
        ? [rule, "prefer-to-be-truthy", "prefer-to-be-falsy"]
        : [rule];
    const optionsFile = path.join(fixtures, plugin, directory, "options.json");
    const domainLevel = directory.endsWith("@domain")
      ? domainStructure({ files: ["**"] }).overrides[0].rules[`${plugin}/${rule}`]
      : undefined;
    const level =
      domainLevel ??
      (existsSync(optionsFile) ? ["error", ...[JSON.parse(readFileSync(optionsFile, "utf8"))].flat()] : "error");
    const config = path.join(work, `${plugin}-${directory}.json`);
    if (entry !== null) {
      writeFileSync(
        config,
        JSON.stringify({
          categories: { correctness: "off" },
          jsPlugins: [{ name: plugin, specifier: path.join(root, entry) }],
          rules: { [`${plugin}/${rule}`]: level },
        }),
      );
    }
    let raw = "";
    try {
      raw = execFileSync(
        oxlint,
        ["-c", entry === null ? baseConfig : config, "-f", "json", path.join(fixtures, plugin, directory)],
        {
          encoding: "utf8",
        },
      );
    } catch (error) {
      raw = error.stdout;
    }
    const parsed = JSON.parse(raw);
    const diagnostics = Array.isArray(parsed) ? parsed : parsed.diagnostics;
    if (plugin === "structure" && rule === "file-role") {
      const enabledRoles = typeof level === "string" ? [] : (level[1].roles ?? []);
      for (const diagnostic of diagnostics.filter((entry) => entry.message.includes("does not name its role"))) {
        const listedRoles = diagnostic.message
          .split("where role is one of ")[1]
          .split(", or name a test")[0]
          .split(", ");
        for (const role of [
          "build",
          "command",
          "message",
          "model",
          "subscription",
          "update",
          "aggregate",
          "context",
          "event",
          "external",
          "id",
          "middleware",
          "policy",
          "projection",
          "query",
          "rejection",
          "saga",
          "stream",
        ]) {
          if (listedRoles.includes(`.${role}`) !== enabledRoles.includes(role)) {
            failures += 1;
            console.log(
              `FAIL ${directory}: the suggested role list must ${enabledRoles.includes(role) ? "include" : "omit"} .${role}`,
            );
          }
        }
      }
    }
    for (const file of walk(path.join(fixtures, plugin, directory)).filter(
      (entry) => !entry.endsWith("options.json"),
    )) {
      const hits = diagnostics.filter(
        (d) => path.resolve(d.filename) === file && relatedRules.some((name) => String(d.code).includes(name)),
      ).length;
      const expectHit = file.includes(`${path.sep}violations${path.sep}`);
      checked += 1;
      if (expectHit !== hits > 0) {
        failures += 1;
        console.log(
          `FAIL ${path.relative(fixtures, file)}: expected ${expectHit ? "a report" : "no report"}, got ${hits}`,
        );
      }
    }
  }
}
console.log(`${checked - failures}/${checked} fixtures behave as labeled`);
const autofix = path.join(work, "autofix");
mkdirSync(autofix);
symlinkSync(path.join(root, "node_modules"), path.join(autofix, "node_modules"));
writeFileSync(path.join(autofix, "package.json"), JSON.stringify({ type: "module" }));
const autofixFiles = [
  "base/no-useless-undefined/near-misses/required-argument.pure.ts",
  "base/consistent-test-it/near-misses/imported-it.pure.test.ts",
  "base/consistent-test-it/near-misses/effect-it.pure.test.ts",
  "base/consistent-test-it/near-misses/describe-it.pure.test.ts",
].map((file) => {
  const target = path.join(autofix, path.basename(file));
  copyFileSync(path.join(fixtures, file), target);
  return target;
});
const declarations = path.join(autofix, "vitest.d.ts");
writeFileSync(
  declarations,
  [
    'declare module "vitest" {',
    "  export function it(title: string, body: () => void): void;",
    "  export function describe(title: string, body: () => void): void;",
    "  export function expect(value: unknown): { toBe(expected: unknown): void };",
    "}",
    'declare module "@effect/vitest" { export { expect, it } from "vitest"; }',
    "",
  ].join("\n"),
);
let autofixFailures = 0;
const tsconfig = path.join(autofix, "tsconfig.json");
writeFileSync(
  tsconfig,
  JSON.stringify({
    compilerOptions: {
      module: "NodeNext",
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: "ESNext",
      types: [],
    },
    files: [...autofixFiles, declarations],
  }),
);
const typecheck = (phase) => {
  try {
    execFileSync(path.join(root, "node_modules/.bin/effect-tsgo"), ["tsrs", "-p", tsconfig, "--pretty", "false"], {
      encoding: "utf8",
    });
  } catch (error) {
    autofixFailures += 1;
    console.log(`FAIL autofix fixtures ${phase}: ${String(error.stdout)}${String(error.stderr)}`);
  }
};
typecheck("before --fix");
try {
  execFileSync(oxlint, ["-c", baseConfig, "--fix", "-f", "json", ...autofixFiles], { encoding: "utf8" });
} catch (error) {
  if (error.status !== 1) {
    throw error;
  }
  JSON.parse(error.stdout);
}
typecheck("after --fix");
console.log(
  `${autofixFiles.length} autofix fixtures checked before and after --fix; ${autofixFailures} typecheck failures`,
);
process.exit(failures === 0 && autofixFailures === 0 ? 0 : 1);
