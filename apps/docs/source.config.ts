import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { z } from "zod";

import { codeThemes } from "#src/content/markdown/code-themes.config.ts";
import { remarkAdmonitionTags, remarkDocsLinks } from "#src/content/markdown/remark-docs.build.ts";
import { publishedSlugs } from "#src/content/navigation/navigation.pure.ts";

const docs = defineDocs({
  dir: "./content",
  docs: {
    files: publishedSlugs.map((slug) => `${slug}.md`),
    schema: pageSchema.extend({
      description: z.string(),
      status: z.enum(["built", "planned"]),
    }),
  },
  meta: { files: [] },
});

const config = defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      addLanguageClass: true,
      defaultColor: false,
      themes: codeThemes,
      tokenizeTimeLimit: 0,
    },
    remarkPlugins: [remarkAdmonitionTags, remarkDocsLinks],
  },
});

export { docs };

export default config;
