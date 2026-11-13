import { renderLlmsIndex } from "#src/content/markdown/page-markdown.pure.ts";
import { navigation } from "#src/content/navigation/navigation.pure.ts";
import { siteUrl } from "#src/content/site/site.pure.ts";
import { titles } from "#src/content/site/source.config.ts";

export const dynamic = "force-static";

export const GET = (): Response =>
  new Response(
    renderLlmsIndex(
      siteUrl,
      navigation.map((group) => ({
        heading: group.group,
        pages: group.pages.map((slug) => ({ ...titles(slug), slug })),
      })),
    ),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
