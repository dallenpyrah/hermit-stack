import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Array as Arr, String as Str, pipe } from "effect";

import { pageAlignedSource, typeScriptFences } from "#src/fences/code-fences.pure.ts";
import type { CodeFence } from "#src/fences/code-fences.pure.ts";

// Writes every TypeScript fence in content/docs/ to .fences/<page>/line-<n>.ts, where tsconfig.fences.json typechecks it
// With the repo's Effect diagnostics. Each file keeps the page's line numbers, so an error names the page line.

const app = path.resolve(import.meta.dirname, "../..");

const content = path.join(app, "content", "docs");

const out = path.join(app, ".fences");

const pages = pipe(
  readdirSync(content, { recursive: true, withFileTypes: true }),
  Arr.filter((entry) => entry.isFile() && Str.endsWith(".mdx")(entry.name)),
  Arr.map((entry) => path.relative(content, path.join(entry.parentPath, entry.name))),
);

const writeFence = (page: string, fence: CodeFence): string => {
  const directory = path.join(out, Str.replace(/\.mdx$/u, "")(page));
  const file = path.join(directory, `line-${fence.line}.ts`);

  mkdirSync(directory, { recursive: true });
  writeFileSync(file, pageAlignedSource(fence));

  return file;
};

rmSync(out, { force: true, recursive: true });

const writePage = (page: string): readonly string[] => {
  const fences = typeScriptFences(readFileSync(path.join(content, page), "utf8"));

  return Arr.map(fences, (fence) => writeFence(page, fence));
};

const written = Arr.flatMap(pages, writePage);

console.log(`Wrote ${written.length} code blocks from ${pages.length} pages to .fences/`);
