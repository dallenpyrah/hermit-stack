import { existsSync, globSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";

const skipped = new Set([".git", ".turbo", "dist", "node_modules"]);
const declaration = /\.d\.[cm]?ts$/u;

const leaves = (entry) => {
  if (typeof entry === "string") {
    return [entry];
  }
  if (Array.isArray(entry)) {
    return entry.flatMap(leaves);
  }
  return typeof entry === "object" && entry !== null ? Object.values(entry).flatMap(leaves) : [];
};

const subpaths = (exports) => {
  if (typeof exports === "object" && exports !== null && Object.keys(exports).some((key) => key.startsWith("."))) {
    return Object.entries(exports);
  }
  return exports === undefined ? [] : [[".", exports]];
};

const installed = (directory, scope) => {
  const folder = path.join(directory, "node_modules", scope);
  return existsSync(folder) ? readdirSync(folder).map((name) => path.join(folder, name)) : [];
};

const roleImports = (root, packages, { definitionServices } = {}) => {
  const scopes = packages.filter((entry) => entry.endsWith("/"));
  const workspace = globSync("**/package.json", {
    cwd: root,
    exclude: (entry) => skipped.has(path.basename(typeof entry === "string" ? entry : entry.name)),
  }).map((file) => path.dirname(path.join(root, file)));
  const directories = new Set(
    [...workspace, ...workspace.flatMap((directory) => scopes.flatMap((scope) => installed(directory, scope)))]
      .filter((directory) => existsSync(path.join(directory, "package.json")))
      .map((directory) => realpathSync(directory)),
  );
  const exports = Object.fromEntries(
    [...directories].flatMap((directory) => {
      const { exports: map, name } = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
      if (typeof name !== "string" || !scopes.some((scope) => name.startsWith(scope))) {
        return [];
      }
      return subpaths(map)
        .filter(([key]) => !key.includes("*"))
        .flatMap(([key, entry]) => {
          const file = leaves(entry).find((leaf) => !declaration.test(leaf));
          return file === undefined ? [] : [[`${name}${key.slice(1)}`, file]];
        });
    }),
  );
  return { ...(definitionServices === undefined ? {} : { definitionServices }), exports, packages };
};

export { roleImports };
