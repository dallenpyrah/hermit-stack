import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const docsDirectory = path.join(process.cwd(), "docs");

export const readPage = (slug: string): string => readFileSync(path.join(docsDirectory, `${slug}.md`), "utf8");

export const pageExists = (slug: string): boolean => existsSync(path.join(docsDirectory, `${slug}.md`));
