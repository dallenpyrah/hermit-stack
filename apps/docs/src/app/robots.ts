import type { MetadataRoute } from "next";

import { siteUrl } from "#src/content/site/site.pure.ts";

const robots = (): MetadataRoute.Robots => ({
  rules: { allow: "/", userAgent: "*" },
  sitemap: `${siteUrl}/sitemap.xml`,
});

export default robots;

export const dynamic = "force-static";
