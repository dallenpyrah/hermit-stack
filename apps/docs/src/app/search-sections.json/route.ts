import { searchSections } from "#src/content/search/search-sections.pure.ts";
import { publishedPages } from "#src/content/site/source.config.ts";

export const dynamic = "force-static";

export const GET = (): Response =>
  Response.json(
    searchSections(
      publishedPages.map(({ page }) => ({
        structuredData: page.data.structuredData,
        toc: page.data.toc,
        url: page.url,
      })),
    ),
  );
