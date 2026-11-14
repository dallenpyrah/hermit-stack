import { Option } from "effect";
import { createSearchAPI } from "fumadocs-core/search/server";
import type { AdvancedIndex } from "fumadocs-core/search/server";

import { welcomePage } from "#src/content/navigation/landing-pages.pure.ts";
import { publishedPages } from "#src/content/site/source.config.ts";

export const dynamic = "force-static";

const noHeading = Option.getOrUndefined(Option.none<string>());

type PublishedPage = (typeof publishedPages)[number];

const publishedIndex = ({ page }: PublishedPage): AdvancedIndex => ({
  description: page.data.description,
  id: page.url,
  structuredData: page.data.structuredData,
  title: page.data.title,
  url: page.url,
});

export const { staticGET: GET } = createSearchAPI("advanced", {
  indexes: [
    {
      description: welcomePage.description,
      id: welcomePage.slug,
      structuredData: {
        contents: welcomePage.sections.map((section) => ({ content: section.heading, heading: noHeading })),
        headings: [],
      },
      title: welcomePage.title,
      url: `/${welcomePage.slug}`,
    },
    ...publishedPages.map((entry) => publishedIndex(entry)),
  ],
});
