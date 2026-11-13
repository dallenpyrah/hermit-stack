import { pageBody } from "#src/content/markdown/page-body.build.ts";
import { renderPageMarkdown } from "#src/content/markdown/page-markdown.pure.ts";
import { publishedSlugs } from "#src/content/navigation/navigation.pure.ts";
import { siteUrl } from "#src/content/site/site.pure.ts";
import { pageOf } from "#src/content/site/source.config.ts";

export const dynamic = "force-static";

const markdownOf = (slug: string): string => {
  const page = pageOf(slug);

  return renderPageMarkdown({
    body: pageBody(slug),
    description: page.data.description,
    origin: siteUrl,
    slug,
    title: page.data.title,
  });
};

export const GET = (): Response =>
  new Response(publishedSlugs.map((slug) => markdownOf(slug)).join("\n---\n\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
