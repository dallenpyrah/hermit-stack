import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isDeepStrictEqual, promisify } from "node:util";

import { roleImports } from "../../src/oxlint/role-imports.config.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const oxlint = path.join(root, "node_modules", ".bin", "oxlint");
const plugin = path.join(root, "dist", "oxlint", "structure.mjs");
const helper = path.join(root, "src", "oxlint", "role-imports.config.mjs");
const run = promisify(execFile);
const failures = [];
const expect = (holds, message) => {
  if (!holds) {
    failures.push(message);
  }
};

const base = mkdtempSync(path.join(tmpdir(), "role-imports-"));
const repo = path.join(base, "repo");
const write = (file, text) => {
  mkdirSync(path.dirname(path.join(base, file)), { recursive: true });
  writeFileSync(path.join(base, file), text);
};
const json = (value) => JSON.stringify(value, null, 2);

write("repo/package.json", json({ name: "fixture", private: true, type: "module" }));
write(
  "repo/packages/store/package.json",
  json({
    exports: {
      "./*": "./src/*.ts",
      "./plan": "./src/plan.schema.ts",
      "./wal": {
        "@akterjs/source": "./src/wal.adapter.ts",
        default: "./dist/wal.adapter.mjs",
        types: "./dist/wal.adapter.d.mts",
      },
    },
    name: "@akter-cloud/store",
  }),
);
write("repo/packages/price/package.json", json({ exports: "./src/price.pure.ts", name: "@akter-cloud/price" }));
write("repo/packages/other/package.json", json({ exports: "./src/other.adapter.ts", name: "other" }));
write("repo/packages/seat/package.json", json({ name: "@akter-cloud/seat" }));
write(
  "sibling/effect/package.json",
  json({
    exports: { "./contract": { types: "./dist/akter.service.d.mts", default: "./src/akter.service.ts" } },
    name: "@akterjs/effect",
  }),
);
mkdirSync(path.join(repo, "packages/seat/node_modules/@akterjs"), { recursive: true });
symlinkSync(path.join(base, "sibling/effect"), path.join(repo, "packages/seat/node_modules/@akterjs/effect"));

const built = roleImports(repo, ["@akter-cloud/", "@akterjs/", "zod"]);
const expected = {
  exports: {
    "@akter-cloud/price": "./src/price.pure.ts",
    "@akter-cloud/store/plan": "./src/plan.schema.ts",
    "@akter-cloud/store/wal": "./src/wal.adapter.ts",
    "@akterjs/effect/contract": "./src/akter.service.ts",
  },
  packages: ["@akter-cloud/", "@akterjs/", "zod"],
};
expect(
  isDeepStrictEqual(built, expected),
  `the map built from the workspace is wrong:\n${json(built)}\nexpected:\n${json(expected)}`,
);

const allowing = roleImports(repo, ["@akterjs/"], { definitionServices: ["@akterjs/effect/contract"] });
expect(
  isDeepStrictEqual(allowing.definitionServices, ["@akterjs/effect/contract"]),
  `roleImports drops the definition services it was given:\n${json(allowing)}`,
);

write(
  "repo/packages/seat/src/seat.pure.ts",
  [
    'import type { Wal } from "@akter-cloud/store/wal";',
    'import { Plan } from "@akter-cloud/store/plan";',
    'import { total } from "@akter-cloud/price";',
    'import { append } from "@akter-cloud/store/wal";',
    'import { seats } from "@akter-cloud/store/seats";',
    "",
    "export const seat = (wal: Wal) => [wal, Plan, total, append, seats];",
    "",
  ].join("\n"),
);
const lint = (config) =>
  run(oxlint, ["-c", config, "-f", "json", "packages"], { cwd: repo }).then(
    ({ stdout }) => ({ code: 0, output: stdout }),
    (error) => ({ code: error.code, errors: String(error.stderr), output: String(error.stdout) }),
  );
const config = (options) => ({
  categories: { correctness: "off" },
  jsPlugins: [{ name: "structure", specifier: plugin }],
  rules: { "structure/role-imports": ["error", options] },
});

write(
  "repo/oxlint.config.ts",
  [
    `import { roleImports } from ${JSON.stringify(helper)};`,
    "",
    `const options = roleImports(import.meta.dirname, ["@akter-cloud/"]);`,
    "",
    `export default ${json(config("OPTIONS"))};`,
    "",
  ]
    .join("\n")
    .replace('"OPTIONS"', "options"),
);
const linted = await lint(path.join(repo, "oxlint.config.ts"));
const messages = linted.code === 1 ? JSON.parse(linted.output).diagnostics.map((diagnostic) => diagnostic.message) : [];
expect(
  messages.length === 2,
  `a config built with roleImports reports ${messages.length} problems, not 2:\n${linted.output}`,
);
expect(
  messages.some((message) =>
    message.startsWith(
      '"@akter-cloud/store/wal" resolves to ./src/wal.adapter.ts. A .pure file imports a .adapter file.',
    ),
  ),
  `a value import of a scoped adapter passes:\n${messages.join("\n")}`,
);
expect(
  messages.some((message) => message.startsWith('A .pure file imports "@akter-cloud/store/seats"')),
  `a scoped specifier missing from the map passes:\n${messages.join("\n")}`,
);

write("repo/no-map.json", json(config({ packages: ["@akter-cloud/"] })));
const noMap = await lint(path.join(repo, "no-map.json"));
expect(
  noMap.code !== 0 &&
    `${noMap.output}${noMap.errors}`.includes("Options validation failed for rule 'structure/role-imports'"),
  `a whole-scope packages option with no exports map loads:\n${noMap.output}${noMap.errors}`,
);

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}
console.log("role-imports.config: the exports map and the fail-closed checks hold");
