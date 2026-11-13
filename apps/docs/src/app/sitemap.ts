import type { MetadataRoute } from "next";

import { pageUrl } from "#src/content/markdown/page-markdown.pure.ts";
import { publishedSlugs, welcomeSlug } from "#src/content/navigation/navigation.pure.ts";
import { siteUrl } from "#src/content/site/site.pure.ts";

const sitemap = (): MetadataRoute.Sitemap =>
  [welcomeSlug, ...publishedSlugs].map((slug) => ({ url: pageUrl(siteUrl, slug) }));

export default sitemap;

export const dynamic = "force-static";
