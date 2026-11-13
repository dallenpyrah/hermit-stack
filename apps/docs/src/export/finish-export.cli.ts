import { existsSync } from "node:fs";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import { publishedSlugs, welcomeSlug } from "#src/content/navigation/navigation.pure.ts";

// Runs after next build. Next writes route handlers under the route's own path, so the Markdown twins land in
// Out/md/<slug>; this moves each to out/<slug>.md beside its page, then fails the build if a file people or agents
// Rely on is missing from the export.

const NONE = 0;

const REQUIRED_FILES = [
  "index.html",
  "404.html",
  "llms.txt",
  "llms-full.txt",
  "search.json",
  "search-sections.json",
  "sitemap.xml",
  "robots.txt",
  "favicon.svg",
];

const out = path.resolve(import.meta.dirname, "..", "..", "out");

const files = async (directory: string): Promise<readonly string[]> => {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });

  return entries.filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name));
};

const moveMarkdownTwins = async (): Promise<void> => {
  const twins = path.join(out, "md");

  for (const file of await files(twins)) {
    const target = path.join(out, `${path.relative(twins, file)}.md`);

    await mkdir(path.dirname(target), { recursive: true });
    await rename(file, target);
  }

  await rm(twins, { recursive: true });
};

const missingFiles = (): readonly string[] => {
  const pages = [welcomeSlug, ...publishedSlugs].flatMap((slug) => [`${slug}.html`, `${slug}.md`]);

  return [...pages, ...REQUIRED_FILES].filter((file) => !existsSync(path.join(out, file)));
};

await moveMarkdownTwins();

const missing = missingFiles();

if (missing.length > NONE) {
  throw new Error(`The export is missing: ${missing.join(", ")}`);
}
