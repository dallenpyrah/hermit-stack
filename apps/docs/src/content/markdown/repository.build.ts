import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { Option } from "effect";

import { contentPath } from "#src/content/site/site.pure.ts";

const ANCHOR_FILE = `${contentPath}/quickstart.md`;

const findRepositoryRoot = (start: string): string => {
  let current = path.resolve(start);

  while (!existsSync(path.join(current, ANCHOR_FILE))) {
    const parent = path.dirname(current);

    if (parent === current) {
      throw new Error(`No ${ANCHOR_FILE} above ${start}`);
    }

    current = parent;
  }

  return current;
};

const repositoryRoot: string = findRepositoryRoot(process.cwd());

const docsDirectory: string = path.join(repositoryRoot, contentPath);

const kindOfPath = (absolute: string): "file" | "directory" => {
  if (statSync(absolute).isDirectory()) {
    return "directory";
  }

  return "file";
};

const pathKind = (repositoryPath: string): "file" | "directory" | undefined => {
  const absolute = path.join(repositoryRoot, repositoryPath);

  if (!existsSync(absolute)) {
    return Option.getOrUndefined(Option.none());
  }

  return kindOfPath(absolute);
};

const readDocsFile = (pagePath: string): string => {
  if (path.isAbsolute(pagePath)) {
    return readFileSync(pagePath, "utf8");
  }

  return readFileSync(path.join(docsDirectory, pagePath), "utf8");
};

const readRepositoryFile = (repositoryPath: string): string =>
  readFileSync(path.join(repositoryRoot, repositoryPath), "utf8");

export { docsDirectory, pathKind, readDocsFile, readRepositoryFile };
