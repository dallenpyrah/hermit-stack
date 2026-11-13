import path from "node:path";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { VFile } from "vfile";

import { stripFrontmatter } from "./headings.build.ts";
import { remarkAdmonitionTags, remarkDocsLinks } from "./remark-docs.build.ts";
import { docsDirectory, readRepositoryFile } from "./repository.build.ts";
import { contentPath } from "#src/content/site/site.pure.ts";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkAdmonitionTags)
  .use(remarkDocsLinks)
  .use(remarkStringify, {
    bullet: "-",
    emphasis: "_",
    fences: true,
    listItemIndent: "one",
    rule: "-",
  });

const pageBody = (slug: string): string => {
  const source = stripFrontmatter(readRepositoryFile(`${contentPath}/${slug}.md`));
  const file = new VFile({ path: path.join(docsDirectory, `${slug}.md`), value: source });

  return String(processor.processSync(file));
};

export { pageBody };
