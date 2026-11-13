#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { catalogOf, pinOf, repositoryUrlOf, tagCandidates } from "./agent-sources.pure.mjs";

const root = process.cwd();
const sourcesDir = path.join(root, ".agent_sources");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const git = (args, cwd = root) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

if (!existsSync(path.join(root, "agent-sources.json"))) {
  console.error("agent-sources: no agent-sources.json in this directory. Run it from a repo root that has one.");
  process.exit(1);
}
const sources = readJson(path.join(root, "agent-sources.json"));
const manifest = readJson(path.join(root, "package.json"));
const workspaceFile = path.join(root, "pnpm-workspace.yaml");
const catalog = existsSync(workspaceFile) ? catalogOf(readFileSync(workspaceFile, "utf8")) : {};

const installedManifest = (name) =>
  [path.join(root, "node_modules", name), path.join(root, "node_modules", ".pnpm", "node_modules", name)]
    .map((directory) => path.join(directory, "package.json"))
    .find((file) => existsSync(file));

const packageOf = (name, pin) => {
  if (pin.startsWith("file:")) {
    return JSON.parse(
      execFileSync("tar", ["-xzOf", path.join(root, pin.slice("file:".length)), "package/package.json"], {
        encoding: "utf8",
      }),
    );
  }
  const installed = installedManifest(name);
  return { ...(installed === undefined ? {} : readJson(installed)), version: pin };
};

const refOf = (url, source, name, version) => {
  if (source.ref !== undefined) {
    return source.ref;
  }
  const tag = tagCandidates(name, version).find(
    (candidate) => git(["ls-remote", "--tags", url, `refs/tags/${candidate}`]) !== "",
  );
  if (tag === undefined) {
    throw new Error(`${url} has no tag for ${name} ${version} (tried ${tagCandidates(name, version).join(", ")})`);
  }
  return `refs/tags/${tag}`;
};

mkdirSync(sourcesDir, { recursive: true });
let failed = false;
for (const [directoryName, source] of Object.entries(sources)) {
  const name = source.package;
  const pin = pinOf(name, catalog, manifest);
  const target = path.join(sourcesDir, directoryName);
  const marker = path.join(target, ".git", "agent-source.json");
  try {
    if (pin === undefined) {
      throw new Error(`${name} is not pinned in pnpm-workspace.yaml's catalog or package.json`);
    }
    const published = packageOf(name, pin);
    const url = source.repository ?? repositoryUrlOf(published.repository);
    if (url === undefined) {
      throw new Error(
        `${name} ${published.version} names no repository; add "repository" to its entry in agent-sources.json`,
      );
    }
    const wanted = { package: name, pin, ref: refOf(url, source, name, published.version), url };
    if (existsSync(marker) && JSON.stringify(readJson(marker)) === JSON.stringify(wanted)) {
      console.log(`${directoryName}: ${name} ${published.version} is up to date`);
      continue;
    }
    rmSync(target, { force: true, recursive: true });
    mkdirSync(target, { recursive: true });
    git(["init", "-q"], target);
    git(["fetch", "-q", "--depth", "1", url, wanted.ref], target);
    git(["checkout", "-q", "--detach", "FETCH_HEAD"], target);
    writeFileSync(marker, JSON.stringify(wanted));
    const subdirectory = typeof published.repository === "object" ? published.repository.directory : undefined;
    console.log(
      `${directoryName}: cloned ${name} ${published.version} from ${url} at ${wanted.ref} (${git(["rev-parse", "--short", "HEAD"], target)})${subdirectory === undefined ? "" : `, package source in ${path.join(".agent_sources", directoryName, subdirectory)}`}`,
    );
  } catch (error) {
    failed = true;
    console.error(`${directoryName}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}
process.exit(failed ? 1 : 0);
