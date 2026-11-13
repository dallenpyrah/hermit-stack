#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignored = process.argv.slice(2).flatMap((arg, index, args) => (args[index - 1] === "--ignore" ? [arg] : []));
const why =
  "A path a doc names in backticks sends readers and agents to it, so a moved or deleted file leaves them looking for code that isn't there";

const tracked = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
  .split("\0")
  .filter((file) => file.endsWith(".md") && !ignored.some((prefix) => file.startsWith(prefix)))
  .filter((file) => existsSync(path.join(root, file)));

const pathLike = (text) =>
  /^[\w./@-]+$/u.test(text) &&
  text.includes("/") &&
  !text.startsWith("@") &&
  !text.startsWith("/") &&
  !text.includes("//");

const generated = new Set([".git", ".turbo", "dist", "node_modules"]);

const packageOf = (dir) => {
  const manifest = path.join(dir, "package.json");
  if (existsSync(manifest)) {
    return JSON.parse(readFileSync(manifest, "utf8"));
  }
  return dir === root || dir === path.dirname(dir) ? undefined : packageOf(path.dirname(dir));
};

const exported = (doc, text) => {
  const exports = packageOf(path.dirname(path.join(root, doc)))?.exports;
  return typeof exports === "object" && exports !== null && Object.hasOwn(exports, text);
};

const checked = (doc, text) => {
  const segments = text.split("/").filter((segment) => segment !== "." && segment !== "..");
  if (segments.length === 0 || generated.has(segments[0]) || exported(doc, text)) {
    return undefined;
  }
  const targets = [path.dirname(path.join(root, doc)), root].map((base) => path.resolve(base, text));
  if (targets.some((target) => path.relative(root, target).startsWith(".."))) {
    return undefined;
  }
  const relative = text.startsWith("./") || text.startsWith("../");
  const anchored = relative
    ? targets
    : [path.dirname(path.join(root, doc)), root]
        .filter((base) => existsSync(path.join(base, segments[0])))
        .map((base) => path.join(base, text));
  if (anchored.length === 0) {
    return undefined;
  }
  return { exists: anchored.some((target) => existsSync(target)) };
};

const missing = tracked.flatMap((doc) => {
  let fenced = false;
  return readFileSync(path.join(root, doc), "utf8")
    .split("\n")
    .flatMap((line, index) => {
      if (/^\s*(```|~~~)/u.test(line)) {
        fenced = !fenced;
        return [];
      }
      if (fenced) {
        return [];
      }
      return [...line.matchAll(/`([^`\n]+)`/gu)]
        .map((match) => match[1].replace(/[:#].*$/u, "").replace(/\/$/u, ""))
        .filter((text) => pathLike(text))
        .filter((text) => checked(doc, text)?.exists === false)
        .map((text) => `${doc}:${index + 1}  ${text} does not exist`);
    });
});

if (missing.length > 0) {
  console.error(
    [
      `${missing.length} ${missing.length === 1 ? "path" : "paths"} named in Markdown ${missing.length === 1 ? "does" : "do"} not exist. ${why}. Fix: point each one at the file's current path or drop it, and write a path that only exists in someone else's project with a placeholder, such as <app>/src/app.layer.ts.`,
      ...missing.map((line) => `  ${line}`),
    ].join("\n"),
  );
  process.exit(1);
}
console.log(`doc-paths: every path named in backticks in ${tracked.length} Markdown files exists`);
